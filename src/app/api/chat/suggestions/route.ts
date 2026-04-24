import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { matchFAQ } from "@/lib/deepseek";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { content, conversationId, excludeIds } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    // 1. Save user message
    let targetConversationId = conversationId;

    if (!targetConversationId) {
      const conversation = await prisma.conversation.create({
        data: {
          userId: session.userId,
          title: content.slice(0, 50),
        },
      });
      targetConversationId = conversation.id;
    }

    const message = await prisma.message.create({
      data: {
        conversationId: targetConversationId,
        role: "user",
        content,
      },
    });

    // 2. Match against FAQ knowledge base only (no AI generation)
    const { suggestions, matchedFAQs } = await matchFAQ(content, excludeIds || []);

    // 3. Save suggestions with faqId reference
    const suggestionsData = [];
    for (const s of suggestions) {
      const saved = await prisma.suggestion.create({
        data: {
          messageId: message.id,
          content: s.content,
          label: s.label,
        },
      });
      suggestionsData.push({
        id: saved.id,
        label: saved.label,
        content: saved.content,
        faqId: s.faqId,
        faqQuestion: s.faqQuestion,
      });
    }

    // 4. Log interaction
    await prisma.interactionLog.create({
      data: {
        userId: session.userId,
        type: "suggestion",
        input: content,
        output: JSON.stringify({ suggestions, matchedFAQs }),
        metadata: JSON.stringify({
          matchedFAQs: matchedFAQs.map((f) => ({ id: f.id, question: f.question, score: f.score })),
        }),
      },
    });

    return NextResponse.json({
      conversationId: targetConversationId,
      messageId: message.id,
      suggestions: suggestionsData,
      faqReferences: matchedFAQs.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        score: f.score,
      })),
      reasoning:
        suggestions.length > 0
          ? `为您推荐 ${suggestions.length} 个与之相关的FAQ话术`
          : "暂未找到匹配的话术，建议先添加FAQ知识库",
    });
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json({ error: "生成建议失败，请重试" }, { status: 500 });
  }
}
