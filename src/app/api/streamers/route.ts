import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/streamers - List streamers
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    const isAdmin = user?.role === "admin";

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (!isAdmin) {
      where.userId = session.userId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const streamers = await prisma.streamer.findMany({
      where: where as any,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ streamers });
  } catch (error) {
    console.error("List streamers error:", error);
    return NextResponse.json({ error: "获取主播列表失败" }, { status: 500 });
  }
}

// POST /api/streamers - Create streamer
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { name, age, phone, address, photo, photos, resume, bio, stage } = await request.json();

    if (!name && !phone) {
      return NextResponse.json(
        { error: "姓名或手机号至少填一项" },
        { status: 400 }
      );
    }

    const streamer = await prisma.streamer.create({
      data: {
        name: name || null,
        age: age || null,
        phone: phone || null,
        address: address || null,
        photo: photo || null,
        photos: photos || null,
        resume: resume || null,
        bio: bio || null,
        stage: stage || null,
        userId: session.userId,
      },
    });

    return NextResponse.json({ streamer }, { status: 201 });
  } catch (error) {
    console.error("Create streamer error:", error);
    return NextResponse.json({ error: "创建主播档案失败" }, { status: 500 });
  }
}
