import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { polishContent } from "@/lib/deepseek";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { content, tone, streamerInfo } = await request.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    const validTones = ["natural", "lively", "cute", "professional", "gentle"];
    const selectedTone = validTones.includes(tone) ? tone : "natural";

    const polished = await polishContent(content, selectedTone, streamerInfo);

    return NextResponse.json({ polished });
  } catch (error) {
    console.error("Polishing error:", error);
    return NextResponse.json(
      { error: "润色失败，请重试" },
      { status: 500 }
    );
  }
}
