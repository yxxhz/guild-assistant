import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateContent } from "@/lib/deepseek";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { prompt, type } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "请输入内容" }, { status: 400 });
    }

    const result = await generateContent(
      prompt,
      type || "recruitment"
    );

    // Log interaction
    await prisma.interactionLog.create({
      data: {
        userId: session.userId,
        type: "generation",
        input: JSON.stringify({ prompt, type }),
        output: result,
      },
    });

    return NextResponse.json({ content: result });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "生成失败" },
      { status: 500 }
    );
  }
}
