import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    let entries: Array<{ question: string; answer: string; category: string }> = [];

    // Try parsing as JSON
    if (file.name.endsWith(".json")) {
      try {
        const data = JSON.parse(text);
        entries = Array.isArray(data) ? data : data.entries || [];
      } catch {
        return NextResponse.json(
          { error: "JSON格式错误，请确保是数组格式或包含entries字段" },
          { status: 400 }
        );
      }
    } else {
      // Parse as CSV/TSV: question\tanswer\tcategory
      const separator = text.includes("\t") ? "\t" : ",";
      for (const line of lines) {
        const parts = line.split(separator);
        if (parts.length >= 2) {
          entries.push({
            question: parts[0].trim(),
            answer: parts[1].trim(),
            category: parts[2]?.trim() || "general",
          });
        }
      }
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "文件中没有解析到有效数据" },
        { status: 400 }
      );
    }

    // Batch create
    let created = 0;
    for (const entry of entries) {
      if (entry.question && entry.answer) {
        await prisma.knowledgeBase.create({ data: entry });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      imported: created,
      total: entries.length,
    });
  } catch (error) {
    console.error("FAQ import error:", error);
    return NextResponse.json(
      { error: "导入失败" },
      { status: 500 }
    );
  }
}
