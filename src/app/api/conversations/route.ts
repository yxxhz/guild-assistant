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

    // List all conversations
    const conversations = await prisma.conversation.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ conversations });
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
