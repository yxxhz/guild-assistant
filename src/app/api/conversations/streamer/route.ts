import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/conversations/streamer?conversationId=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ error: "缺少 conversationId" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { streamerInfo: true, streamerId: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 });
    }

    // Always fetch live data from Streamer table when linked,
    // so changes in streamer management are immediately reflected
    if (conversation.streamerId) {
      const streamer = await prisma.streamer.findUnique({
        where: { id: conversation.streamerId },
      });
      if (streamer) {
        const fields = ["name", "age", "phone", "address", "photo", "photos", "resume", "bio", "stage"];
        const info: Record<string, string> = {};
        for (const field of fields) {
          if (streamer[field as keyof typeof streamer]) {
            info[field] = streamer[field as keyof typeof streamer] as string;
          }
        }
        return NextResponse.json({
          streamerInfo: info,
          streamerId: conversation.streamerId,
        });
      }
    }

    // Fallback: no linked streamer — return conversation's cached info
    const info = conversation.streamerInfo
      ? JSON.parse(conversation.streamerInfo)
      : {};

    return NextResponse.json({
      streamerInfo: info,
      streamerId: null,
    });
  } catch (error) {
    console.error("Get streamer info error:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

// PUT /api/conversations/streamer
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId, streamerId, ...infoFields } = body;

    if (!conversationId) {
      return NextResponse.json({ error: "缺少 conversationId" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 });
    }

    // Merge logic: merge incoming fields with existing streamerInfo
    const currentInfo = conversation.streamerInfo
      ? JSON.parse(conversation.streamerInfo)
      : {};

    const merged: Record<string, string> = { ...currentInfo };

    // New values overwrite old, empty values don't overwrite non-empty
    for (const [key, value] of Object.entries(infoFields)) {
      if (value !== null && value !== "") {
        merged[key] = value as string;
      } else if (!merged[key]) {
        // Only set empty if there was no existing value
        merged[key] = (value as string) || "";
      }
    }

    // If linking to a streamer profile, merge profile fields as base
    if (streamerId !== undefined) {
      if (streamerId) {
        const streamer = await prisma.streamer.findUnique({
          where: { id: streamerId },
        });
        if (streamer) {
          // Streamer profile fields fill in blanks (lower priority than conversation info)
          const profileFields = ["name", "age", "phone", "address", "photo", "photos", "resume", "bio", "stage"];
          for (const field of profileFields) {
            if (!merged[field] && streamer[field as keyof typeof streamer]) {
              merged[field] = streamer[field as keyof typeof streamer] as string;
            }
          }
        }
      }
      // Clear conversation fields that aren't in the merged result
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          streamerId: streamerId || null,
          streamerInfo: JSON.stringify(merged),
        },
      });
    } else {
      // Just updating info fields without changing link
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { streamerInfo: JSON.stringify(merged) },
      });
    }

    return NextResponse.json({ success: true, streamerInfo: merged });
  } catch (error) {
    console.error("Update streamer info error:", error);
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}
