import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/streamers/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const streamer = await prisma.streamer.findUnique({ where: { id } });

    if (!streamer) {
      return NextResponse.json({ error: "主播档案不存在" }, { status: 404 });
    }

    // Permission check
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (streamer.userId !== session.userId && user?.role !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    return NextResponse.json({ streamer });
  } catch (error) {
    console.error("Get streamer error:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

// PUT /api/streamers/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.streamer.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "主播档案不存在" }, { status: 404 });
    }

    // Permission check
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (existing.userId !== session.userId && user?.role !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { name, age, phone, address, photo, photos, resume, bio, stage } = await request.json();
    const updateData: Record<string, string | null> = {};

    if (name !== undefined) updateData.name = name || null;
    if (age !== undefined) updateData.age = age || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (address !== undefined) updateData.address = address || null;
    if (photo !== undefined) updateData.photo = photo || null;
    if (photos !== undefined) updateData.photos = photos || null;
    if (resume !== undefined) updateData.resume = resume || null;
    if (bio !== undefined) updateData.bio = bio || null;
    if (stage !== undefined) updateData.stage = stage || null;

    const streamer = await prisma.streamer.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ streamer });
  } catch (error) {
    console.error("Update streamer error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

// DELETE /api/streamers/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.streamer.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "主播档案不存在" }, { status: 404 });
    }

    // Permission check
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (existing.userId !== session.userId && user?.role !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    // Unlink from conversations
    await prisma.conversation.updateMany({
      where: { streamerId: id },
      data: { streamerId: null },
    });

    await prisma.streamer.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete streamer error:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
