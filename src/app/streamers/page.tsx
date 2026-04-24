"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

interface Streamer {
  id: string;
  name: string | null;
  age: string | null;
  phone: string | null;
  address: string | null;
  photo: string | null;
  photos: string | null;
  resume: string | null;
  bio: string | null;
  stage: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  age: string;
  phone: string;
  address: string;
  photo: string;
  photos: string[];
  resume: string;
  resumeName: string;
  bio: string;
  stage: string;
}

const STAGE_LABELS: Record<string, string> = {
  initial: "初次联系",
  interested: "表示兴趣",
  negotiation: "洽谈细节",
  visit: "邀约到面",
  signed: "已签约",
  closed: "已关闭",
};

const DEFAULT_AVATAR = (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <ellipse cx="50" cy="38" rx="35" ry="38" fill="#4A3728" />
    <path d="M15 35 Q15 10 50 8 Q85 10 85 35" fill="#4A3728" />
    <circle cx="50" cy="42" r="28" fill="#FDE8D0" />
    <path d="M25 35 Q35 25 50 28 Q65 25 75 35" fill="#4A3728" />
    <ellipse cx="38" cy="42" rx="4" ry="5" fill="#333" />
    <ellipse cx="62" cy="42" rx="4" ry="5" fill="#333" />
    <ellipse cx="38" cy="41" rx="2" ry="2" fill="white" />
    <ellipse cx="62" cy="41" rx="2" ry="2" fill="white" />
    <ellipse cx="32" cy="50" rx="5" ry="3" fill="#FFB5B5" opacity="0.5" />
    <ellipse cx="68" cy="50" rx="5" ry="3" fill="#FFB5B5" opacity="0.5" />
    <path d="M40 54 Q50 62 60 54" fill="none" stroke="#D4756B" strokeWidth="2" strokeLinecap="round" />
    <path d="M35 68 Q50 65 65 68 L62 95 Q50 100 38 95Z" fill="#FDE8D0" />
  </svg>
);

function parsePhotos(photos: string | null): string[] {
  if (!photos) return [];
  try {
    const parsed = JSON.parse(photos);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseResume(resume: string | null): { name: string; data: string } | null {
  if (!resume) return null;
  try {
    return JSON.parse(resume);
  } catch {
    return null;
  }
}

export default function StreamersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Streamer | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    age: "",
    phone: "",
    address: "",
    photo: "",
    photos: [],
    resume: "",
    resumeName: "",
    bio: "",
    stage: "",
  });
  const [saving, setSaving] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [showDeleteMode, setShowDeleteMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const loadStreamers = async () => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/streamers${params}`);
    const data = await res.json();
    setStreamers(data.streamers || []);
  };

  useEffect(() => {
    if (user) loadStreamers();
  }, [user]);

  useEffect(() => {
    if (user) {
      const timer = setTimeout(loadStreamers, 400);
      return () => clearTimeout(timer);
    }
  }, [search]);

  // Handle image file selection
  const handleImagesSelected = async (files: FileList) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const readers = imageFiles.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        })
    );

    const newPhotos = await Promise.all(readers);
    setFormData((prev) => {
      const updated = [...prev.photos, ...newPhotos];
      return {
        ...prev,
        photos: updated,
        photo: prev.photo || updated[updated.length - 1] || "",
      };
    });
  };

  const handleImagePicker = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleImagesSelected(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  // Resume upload
  const handleResumeUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData((prev) => ({
        ...prev,
        resume: JSON.stringify({ name: file.name, data: e.target?.result as string }),
        resumeName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleResumePicker = () => {
    resumeInputRef.current?.click();
  };

  // Select avatar
  const selectAvatar = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      photo: prev.photos[idx] || "",
    }));
  };

  // Remove a photo
  const removePhoto = (idx: number) => {
    setFormData((prev) => {
      const updated = prev.photos.filter((_, i) => i !== idx);
      const currentPhotoUrl = prev.photos[idx];
      const isRemovingAvatar = prev.photo === currentPhotoUrl;
      return {
        ...prev,
        photos: updated,
        photo: isRemovingAvatar ? (updated[updated.length - 1] || "") : prev.photo,
      };
    });
    if (previewIdx === idx) setPreviewIdx(null);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      age: "",
      phone: "",
      address: "",
      photo: "",
      photos: [],
      resume: "",
      resumeName: "",
      bio: "",
      stage: "",
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name && !formData.phone) return;
    setSaving(true);
    try {
      const body = {
        name: formData.name,
        age: formData.age,
        phone: formData.phone,
        address: formData.address,
        photo: formData.photo,
        photos: formData.photos.length > 0 ? JSON.stringify(formData.photos) : null,
        resume: formData.resume || null,
        bio: formData.bio || null,
        stage: formData.stage,
      };

      if (editing) {
        await fetch(`/api/streamers/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/streamers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      loadStreamers();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s: Streamer) => {
    const parsedPhotos = parsePhotos(s.photos);
    const parsedResume = parseResume(s.resume);
    setEditing(s);
    setFormData({
      name: s.name || "",
      age: s.age || "",
      phone: s.phone || "",
      address: s.address || "",
      photo: s.photo || (parsedPhotos[0] ?? "") || "",
      photos: parsedPhotos,
      resume: s.resume || "",
      resumeName: parsedResume?.name || "",
      bio: s.bio || "",
      stage: s.stage || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该主播档案？关联的会话将解除绑定。")) return;
    await fetch(`/api/streamers/${id}`, { method: "DELETE" });
    loadStreamers();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">主播管理</h1>
        <button
          onClick={() => {
            setEditing(null);
            resetForm();
            setShowForm(true);
          }}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新增主播
        </button>
      </header>

      {/* Search */}
      <div className="px-6 py-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索姓名或手机号..."
          className="max-w-md w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-0">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {editing ? "编辑主播档案" : "新增主播档案"}
              </h2>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
              {/* Photo upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">照片</label>
                {/* Drop zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={handleImagePicker}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-500">
                    <span className="text-indigo-500 font-medium">点击上传</span> 或拖拽图片到此处
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">支持多选，支持右键复制粘贴上传</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleImagesSelected(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
                {/* Thumbnails */}
                {formData.photos.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500">
                        共 {formData.photos.length} 张
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDeleteMode(!showDeleteMode)}
                        className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                          showDeleteMode
                            ? "bg-red-100 text-red-600 border border-red-200"
                            : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"
                        }`}
                      >
                        {showDeleteMode ? "完成" : "管理"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.photos.map((url, idx) => (
                        <div key={idx} className="relative group">
                          {showDeleteMode && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removePhoto(idx); }}
                              className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          <div
                            onClick={() => setPreviewIdx(idx)}
                            className={`w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:opacity-90 ${
                              formData.photo === url
                                ? "border-indigo-500 ring-2 ring-indigo-200"
                                : "border-gray-200"
                            }`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </div>
                          {/* Avatar badge (top-right checkmark for current avatar) */}
                          {formData.photo === url && !showDeleteMode && (
                            <div className="absolute -top-1.5 -right-1.5 bg-indigo-500 text-white rounded-full p-0.5 shadow">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          {/* Set as avatar icon (bottom-right, only on non-avatar) */}
                          {formData.photo !== url && !showDeleteMode && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); selectAvatar(idx); }}
                              className="absolute -bottom-1 -right-1 w-5 h-5 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-colors"
                              title="设为主头像"
                            >
                              <svg className="w-3 h-3 text-gray-400 hover:text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Photo preview modal */}
              {previewIdx !== null && formData.photos[previewIdx] && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewIdx(null)}>
                  <div className="relative max-w-2xl max-h-full" onClick={(e) => e.stopPropagation()}>
                    <img
                      src={formData.photos[previewIdx]}
                      alt="预览"
                      className="max-w-full max-h-[80vh] rounded-lg"
                    />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAvatar(previewIdx);
                          setPreviewIdx(null);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700"
                      >
                        设为头像
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          removePhoto(previewIdx);
                        }}
                        className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600"
                      >
                        删除
                      </button>
                    </div>
                    {formData.photos.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewIdx(previewIdx > 0 ? previewIdx - 1 : formData.photos.length - 1);
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow"
                        >
                          <svg className="w-5 h-5 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewIdx(previewIdx < formData.photos.length - 1 ? previewIdx + 1 : 0);
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow"
                        >
                          <svg className="w-5 h-5 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewIdx(null)}
                      className="absolute -top-3 -right-3 p-1.5 bg-white rounded-full shadow hover:bg-gray-100"
                    >
                      <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Name + Age */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">年龄</label>
                  <input
                    type="text"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Stage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">聊天阶段</label>
                <select
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="">选择阶段</option>
                  {Object.entries(STAGE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Resume upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">个人简历</label>
                <div
                  onClick={handleResumePicker}
                  className="border-2 border-dashed border-gray-300 hover:border-indigo-300 rounded-xl p-3 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-gray-500">
                    <span className="text-indigo-500 font-medium">点击上传</span> 简历文件
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">支持 Word、PDF、图片等格式</p>
                  <input
                    ref={resumeInputRef}
                    type="file"
                    accept=".doc,.docx,.pdf,.jpg,.jpeg,.png,.gif"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleResumeUpload(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
                {formData.resumeName && (
                  <div className="mt-2 flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-gray-700 truncate">{formData.resumeName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, resume: "", resumeName: "" }))}
                      className="text-xs text-red-500 hover:text-red-600 flex-shrink-0"
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">个人经历</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="输入主播的个人经历、过往直播经验、擅长领域等..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  onPaste={(e) => {
                    // Allow paste, handle any clipboard images
                    const items = e.clipboardData.items;
                    const imageFiles: File[] = [];
                    for (const item of Array.from(items)) {
                      if (item.type.startsWith("image/")) {
                        const file = item.getAsFile();
                        if (file) imageFiles.push(file);
                      }
                    }
                    if (imageFiles.length > 0) {
                      e.preventDefault();
                      // Paste images into photo upload
                      const dt = new DataTransfer();
                      imageFiles.forEach((f) => dt.items.add(f));
                      handleImagesSelected(dt.files);
                    }
                  }}
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-white pb-1">
                <button type="button" onClick={() => { setShowForm(false); setPreviewIdx(null); }} className="px-4 py-2 text-gray-700 text-sm rounded-lg hover:bg-gray-100">
                  取消
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Streamer list */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {streamers.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">暂无主播档案</p>
            <p className="text-sm">点击右上角"新增主播"创建档案，或在会话中自动创建</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {streamers.map((s) => {
              const parsedPhotos = parsePhotos(s.photos);
              const parsedResume = parseResume(s.resume);
              return (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-gray-200">
                      {s.photo ? (
                        <img src={s.photo} alt={s.name || ""} className="w-full h-full object-cover" />
                      ) : (
                        DEFAULT_AVATAR
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900">{s.name || "未命名"}</h3>
                      <div className="mt-1 space-y-0.5">
                        {s.age && <p className="text-xs text-gray-500">年龄: {s.age}</p>}
                        {s.phone && <p className="text-xs text-gray-500">手机: {s.phone}</p>}
                        {s.address && <p className="text-xs text-gray-500 truncate">地址: {s.address}</p>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {s.stage && (
                          <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {STAGE_LABELS[s.stage] || s.stage}
                          </span>
                        )}
                        {parsedPhotos.length > 1 && (
                          <span className="text-xs text-gray-400">
                            {parsedPhotos.length}张照片
                          </span>
                        )}
                        {parsedResume && (
                          <span className="text-xs text-gray-400 flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            简历
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Bio preview */}
                  {s.bio && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500 line-clamp-2">{s.bio}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => handleEdit(s)} className="text-xs text-indigo-600 hover:text-indigo-700">
                      编辑
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="text-xs text-red-500 hover:text-red-600">
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
