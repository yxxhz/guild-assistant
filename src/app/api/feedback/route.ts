import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { boostFAQWeight } from "@/lib/deepseek";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { suggestionId, action, faqId } = await request.json();

    if (!suggestionId || !action) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    if (!["selected", "rejected", "refresh"].includes(action)) {
      return NextResponse.json({ error: "无效的操作类型" }, { status: 400 });
    }

    // Upsert feedback
    const feedback = await prisma.suggestionFeedback.upsert({
      where: { suggestionId },
      update: { action },
      create: {
        suggestionId,
        userId: session.userId,
        action,
      },
    });

    // Boost FAQ weight when suggestion is selected
    if (action === "selected" && faqId) {
      await boostFAQWeight(faqId);
    }

    // Log interaction
    await prisma.interactionLog.create({
      data: {
        userId: session.userId,
        type: "feedback",
        input: suggestionId,
        output: action,
        metadata: JSON.stringify({ suggestionId, action, faqId }),
      },
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json({ error: "记录反馈失败" }, { status: 500 });
  }
}
