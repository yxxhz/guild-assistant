import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/conversations/message — add a message to a conversation
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { conversationId, role, content } = await request.json();

    if (!conversationId || !role || !content) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    if (!["user", "assistant", "system"].includes(role)) {
      return NextResponse.json({ error: "无效的 role" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      return NextResponse.json({ error: "对话不存在" }, { status: 404 });
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Create message error:", error);
    return NextResponse.json({ error: "保存消息失败" }, { status: 500 });
  }
}
