import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/faq - List all FAQ entries
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { question: { contains: search } },
        { answer: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.knowledgeBase.findMany({
        where: where as any,
        orderBy: { usageCount: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.knowledgeBase.count({ where: where as any }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("FAQ list error:", error);
    return NextResponse.json(
      { error: "获取FAQ列表失败" },
      { status: 500 }
    );
  }
}

// POST /api/faq - Create FAQ entry
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { question, answer, category, keywords } = await request.json();

    if (!question || !answer) {
      return NextResponse.json(
        { error: "问题和答案不能为空" },
        { status: 400 }
      );
    }

    const entry = await prisma.knowledgeBase.create({
      data: {
        question,
        answer,
        category: category || "general",
        keywords: keywords || "",
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("FAQ create error:", error);
    return NextResponse.json(
      { error: "创建FAQ失败" },
      { status: 500 }
    );
  }
}

// PUT /api/faq - Update FAQ entry
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id, question, answer, category, keywords } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "缺少ID" }, { status: 400 });
    }

    const entry = await prisma.knowledgeBase.update({
      where: { id },
      data: {
        ...(question !== undefined && { question }),
        ...(answer !== undefined && { answer }),
        ...(category !== undefined && { category }),
        ...(keywords !== undefined && { keywords }),
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("FAQ update error:", error);
    return NextResponse.json(
      { error: "更新FAQ失败" },
      { status: 500 }
    );
  }
}

// DELETE /api/faq - Delete FAQ entry(s)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const ids = searchParams.get("ids");

    if (ids) {
      // Batch delete
      const idList = ids.split(",").filter(Boolean);
      if (idList.length === 0) {
        return NextResponse.json({ error: "请选择要删除的条目" }, { status: 400 });
      }
      await prisma.knowledgeBase.deleteMany({
        where: { id: { in: idList } },
      });
      return NextResponse.json({ success: true, deleted: idList.length });
    }

    if (!id) {
      return NextResponse.json({ error: "缺少ID" }, { status: 400 });
    }

    await prisma.knowledgeBase.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FAQ delete error:", error);
    return NextResponse.json(
      { error: "删除FAQ失败" },
      { status: 500 }
    );
  }
}
