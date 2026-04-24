import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("id");

    if (conversationId) {
      // Get single conversation with messages
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: session.userId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              suggestions: {
                include: {
                  feedback: true,
                },
              },
            },
          },
        },
      });

      if (!conversation) {
        return NextResponse.json(
          { error: "对话不存在" },
          { status: 404 }
        );
      }

      return NextResponse.json({ conversation });
    }

    // List all conversations with last user message and serial number
    const conversations = await prisma.conversation.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          where: { role: "user" },
          select: { content: true, createdAt: true },
        },
      },
    });

    // Stable serial number based on creation order
    const allIds = await prisma.conversation.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const serialNumbers = new Map<string, number>();
    allIds.forEach((c, i) => serialNumbers.set(c.id, i + 1));

    // Batch fetch live streamer data for sidebar display
    const linkedIds = conversations
      .map((c) => c.streamerId)
      .filter((id): id is string => id !== null);
    const liveStreamers =
      linkedIds.length > 0
        ? await prisma.streamer.findMany({
            where: { id: { in: linkedIds } },
            select: { id: true, name: true, photo: true },
          })
        : [];
    const liveStreamerMap = new Map(liveStreamers.map((s) => [s.id, s]));

    const result = conversations.map((c) => {
      const info = c.streamerInfo ? JSON.parse(c.streamerInfo) : {};
      const live = c.streamerId ? liveStreamerMap.get(c.streamerId) : undefined;
      return {
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
        streamerId: c.streamerId,
        serialNumber: serialNumbers.get(c.id) || 0,
        lastMessage: c.messages[0] || null,
        // Live streamer data if linked, fallback to cached streamerInfo
        displayName: live?.name || info.name || null,
        displayPhoto: live?.photo || info.photo || null,
        streamerInfo: info,
      };
    });

    return NextResponse.json({ conversations: result });
  } catch (error) {
    console.error("Conversations error:", error);
    return NextResponse.json(
      { error: "获取对话列表失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少ID" }, { status: 400 });
    }

    // Delete associated messages and suggestions first
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      select: { id: true },
    });

    for (const msg of messages) {
      await prisma.suggestionFeedback.deleteMany({
        where: { suggestion: { messageId: msg.id } },
      });
      await prisma.suggestion.deleteMany({ where: { messageId: msg.id } });
    }
    await prisma.message.deleteMany({ where: { conversationId: id } });
    await prisma.conversation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return NextResponse.json(
      { error: "删除失败" },
      { status: 500 }
    );
  }
}
