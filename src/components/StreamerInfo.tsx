"use client";

import { useState, useEffect, useRef } from "react";

interface StreamerInfoData {
  name?: string;
  age?: string;
  phone?: string;
  address?: string;
  photo?: string;
  photos?: string;
  resume?: string;
  bio?: string;
  stage?: string;
}

interface Streamer {
  id: string;
  name: string | null;
  phone: string | null;
}

const STAGES = [
  { value: "initial", label: "初次联系" },
  { value: "interested", label: "表示兴趣" },
  { value: "negotiation", label: "洽谈细节" },
  { value: "visit", label: "邀约到面" },
  { value: "signed", label: "已签约" },
  { value: "closed", label: "已关闭" },
];

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

function parsePhotos(photos: string | undefined): string[] {
  if (!photos) return [];
  try {
    const parsed = JSON.parse(photos);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface StreamerInfoProps {
  conversationId: string | null;
}

export default function StreamerInfo({ conversationId }: StreamerInfoProps) {
  const [info, setInfo] = useState<StreamerInfoData>({});
  const [streamerId, setStreamerId] = useState<string | null>(null);
  const [streamerName, setStreamerName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<Streamer[]>([]);
  const [linking, setLinking] = useState(false);
  const [searching, setSearching] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Load info when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setInfo({});
      setStreamerId(null);
      setStreamerName("");
      setDirty(false);
      return;
    }
    setDirty(false);
    fetch(`/api/conversations/streamer?conversationId=${conversationId}`)
      .then((r) => r.json())
      .then((data) => {
        setInfo(data.streamerInfo || {});
        setStreamerId(data.streamerId || null);
        setStreamerName(data.streamerInfo?.name || "");
      })
      .catch(console.error);
  }, [conversationId]);

  const update = (field: keyof StreamerInfoData, value: string) => {
    setInfo((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  // Manual save
  const handleSave = async () => {
    if (!conversationId) return;
    setSaving(true);
    try {
      await fetch("/api/conversations/streamer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, ...info }),
      });
      // If linked to a streamer, sync fields back to the streamer profile
      if (streamerId) {
        await fetch(`/api/streamers/${streamerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: info.name,
            age: info.age,
            phone: info.phone,
            address: info.address,
            photo: info.photo,
            photos: info.photos,
            resume: info.resume,
            bio: info.bio,
            stage: info.stage,
          }),
        });
      }
      setDirty(false);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  // Photo file upload
  const handlePhotoUpload = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      update("photo", dataUrl);
      // Also add to photos array
      const existing = parsePhotos(info.photos);
      update("photos", JSON.stringify([...existing, dataUrl]));
    };
    reader.readAsDataURL(file);
  };

  // Search streamers for linking
  const searchStreamers = async (q: string) => {
    setLinkSearch(q);
    if (!q.trim()) {
      setLinkResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/streamers?search=${encodeURIComponent(q)}`);
      const data = await res.json();
      setLinkResults(data.streamers || []);
    } catch {
      setLinkResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Link to a streamer profile
  const linkStreamer = async (target: Streamer) => {
    if (!conversationId) return;
    setLinking(true);
    try {
      const res = await fetch("/api/conversations/streamer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, streamerId: target.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setStreamerId(target.id);
        setStreamerName(target.name || "");
        setInfo(data.streamerInfo || {});
        setDirty(false);
        setShowLinkModal(false);
        setLinkSearch("");
        setLinkResults([]);
      }
    } catch (err) {
      console.error("Link streamer error:", err);
    } finally {
      setLinking(false);
    }
  };

  // Unlink streamer
  const unlinkStreamer = async () => {
    if (!conversationId) return;
    setLinking(true);
    try {
      const res = await fetch("/api/conversations/streamer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, streamerId: null }),
      });
      if (res.ok) {
        const data = await res.json();
        setStreamerId(null);
        setStreamerName("");
        setInfo(data.streamerInfo || {});
        setDirty(false);
      }
    } catch (err) {
      console.error("Unlink streamer error:", err);
    } finally {
      setLinking(false);
    }
  };

  const photosList = parsePhotos(info.photos);

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-700">主播信息</h3>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <svg
            className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {collapsed ? null : !conversationId ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-gray-400 text-center">新建对话后可添加主播信息</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Streamer linking section */}
          <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
            {streamerId ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm text-gray-700 truncate">{streamerName || "已关联主播"}</span>
                </div>
                <button
                  onClick={unlinkStreamer}
                  disabled={linking}
                  className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 disabled:opacity-50"
                >
                  解除
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLinkModal(true)}
                className="w-full text-xs text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1 py-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                关联主播档案
              </button>
            )}
          </div>

          {/* Link search modal */}
          {showLinkModal && (
            <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowLinkModal(false)}>
              <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-medium text-gray-900 mb-3">关联主播档案</h3>
                <input
                  type="text"
                  value={linkSearch}
                  onChange={(e) => searchStreamers(e.target.value)}
                  placeholder="搜索姓名或手机号..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
                <div className="mt-2 max-h-60 overflow-y-auto">
                  {searching ? (
                    <div className="text-center py-4 text-sm text-gray-400">搜索中...</div>
                  ) : linkResults.length === 0 ? (
                    linkSearch.trim() ? (
                      <div className="text-center py-4 text-sm text-gray-400">未找到匹配的主播</div>
                    ) : (
                      <div className="text-center py-4 text-sm text-gray-400">输入姓名或手机号搜索</div>
                    )
                  ) : (
                    <div className="space-y-1">
                      {linkResults.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => linkStreamer(s)}
                          disabled={linking}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 text-sm text-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="font-medium">{s.name || "未命名"}</span>
                          {s.phone && <span className="text-gray-400 ml-auto">{s.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => { setShowLinkModal(false); setLinkSearch(""); setLinkResults([]); }}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Photo with thumbnails */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 mb-1">
              {info.photo ? (
                <img src={info.photo} alt="主播" className="w-full h-full object-cover" />
              ) : (
                DEFAULT_AVATAR
              )}
            </div>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="text-xs text-indigo-500 hover:text-indigo-600"
            >
              {info.photo ? "更换照片" : "添加照片"}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]);
                e.target.value = "";
              }}
            />
            {/* Photo thumbnails */}
            {photosList.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                {photosList.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPreviewIdx(idx)}
                    className={`w-10 h-10 rounded-md overflow-hidden border-2 flex-shrink-0 ${
                      info.photo === url ? "border-indigo-500" : "border-gray-200"
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Photo preview modal */}
          {previewIdx !== null && photosList[previewIdx] && (
            <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewIdx(null)}>
              <div className="relative max-w-xs max-h-full" onClick={(e) => e.stopPropagation()}>
                <img src={photosList[previewIdx]} alt="预览" className="max-w-full max-h-[60vh] rounded-lg" />
                <button
                  type="button"
                  onClick={() => setPreviewIdx(null)}
                  className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow hover:bg-gray-100"
                >
                  <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="flex justify-center mt-2 gap-2">
                  {photosList.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewIdx(i);
                      }}
                      className={`w-3 h-3 rounded-full ${i === previewIdx ? "bg-white" : "bg-white/40"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">姓名</label>
            <input
              type="text"
              value={info.name || ""}
              onChange={(e) => update("name", e.target.value)}
              placeholder="输入姓名"
              className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* Age */}
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">年龄</label>
            <input
              type="text"
              value={info.age || ""}
              onChange={(e) => update("age", e.target.value)}
              placeholder="输入年龄"
              className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">手机号</label>
            <input
              type="text"
              value={info.phone || ""}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="输入手机号"
              className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">地址</label>
            <input
              type="text"
              value={info.address || ""}
              onChange={(e) => update("address", e.target.value)}
              placeholder="输入地址"
              className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          {/* Stage */}
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">聊天阶段</label>
            <select
              value={info.stage || ""}
              onChange={(e) => update("stage", e.target.value)}
              className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
            >
              <option value="">选择阶段</option>
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Manual save button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className={`w-full py-2 text-sm rounded-lg transition-colors ${
                dirty
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-100 text-gray-400 cursor-default"
              }`}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
