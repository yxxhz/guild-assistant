import OpenAI from "openai";
import { prisma } from "./prisma";

const apiKey = process.env.DEEPSEEK_API_KEY;

const deepseek = apiKey
  ? new OpenAI({
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
      apiKey,
    })
  : null;

export interface SuggestionResult {
  label: string;
  content: string;
  faqId: string;
  faqQuestion: string;
}

export interface SuggestionResponse {
  suggestions: SuggestionResult[];
  reasoning: string;
}

/**
 * Match user input against FAQ knowledge base.
 * Uses keyword-to-keyword matching: parses FAQ keywords field and
 * matches each keyword phrase against user input via fuzzy character/bigram matching.
 * Returns top 3 FAQ answers as A/B/C suggestions.
 */
export async function matchFAQ(
  userInput: string,
  excludeIds: string[] = []
): Promise<{ suggestions: SuggestionResult[]; matchedFAQs: Array<{ id: string; question: string; answer: string; score: number }> }> {
  const allFAQs = await prisma.knowledgeBase.findMany({
    select: { id: true, question: true, answer: true, keywords: true, weight: true },
    where: excludeIds.length > 0 ? { id: { notIn: excludeIds } } : undefined,
  });

  if (allFAQs.length === 0) {
    return {
      suggestions: [],
      matchedFAQs: [],
    };
  }

  const normalizedInput = userInput.toLowerCase().trim();

  // Score each FAQ
  const scored = allFAQs.map((faq) => {
    let keywordScore = 0;
    const faqKeywords = faq.keywords
      ? faq.keywords.split(/[,，、|]/).map((k) => k.trim()).filter(Boolean)
      : [];

    if (faqKeywords.length > 0) {
      // Keyword-to-keyword: fuzzy match each FAQ keyword phrase against user input
      let totalMatch = 0;
      for (const kw of faqKeywords) {
        totalMatch += matchKeywordToInput(kw, normalizedInput);
      }
      keywordScore = totalMatch / faqKeywords.length;
    }

    // Fallback: if no keywords in FAQ or no match, use full-text (question + answer)
    if (keywordScore === 0) {
      const faqText = `${faq.question} ${faq.answer}`.toLowerCase();
      const bigrams = extractBigrams(normalizedInput);
      const matched = bigrams.filter((bg) => faqText.includes(bg)).length;
      keywordScore = matched / Math.max(bigrams.length, 1) * 0.5;
    }

    // Weight bonus (growth flywheel)
    const weightBonus = Math.log2(1 + faq.weight) * 0.1;
    const score = keywordScore + weightBonus;

    return { ...faq, score };
  });

  // Filter: only include FAQs with at least some relevance
  const scoredFiltered = scored.filter((f) => f.score > 0.05);

  // If nothing relevant after filtering, return empty
  if (scoredFiltered.length === 0) {
    return {
      suggestions: [],
      matchedFAQs: [],
    };
  }

  // Sort by score descending, take top 3
  const top3 = scoredFiltered
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const labels = ["A", "B", "C"];
  const suggestions = top3.map((faq, i) => ({
    label: labels[i] || String.fromCharCode(65 + i),
    content: faq.answer,
    faqId: faq.id,
    faqQuestion: faq.question,
  }));

  return {
    suggestions,
    matchedFAQs: top3.map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      score: r.score,
    })),
  };
}

/**
 * Fuzzy match a single keyword phrase against user input.
 * Uses multi-level strategy for Chinese text:
 *   1. Exact substring → perfect match (1.0)
 *   2. Short keyword (≤3 chars): all chars present → 0.8
 *   3. Long keyword: bigram overlap ratio
 */
function matchKeywordToInput(keyword: string, userInput: string): number {
  const kw = keyword.toLowerCase().trim();
  const input = userInput.toLowerCase();

  if (!kw || kw.length < 2) return 0;

  // Level 1: Exact continuous substring match
  if (input.includes(kw)) return 1.0;

  // Level 2: For short keywords (2-3 chars), check all characters present
  if (kw.length <= 3) {
    const allPresent = [...kw].every((ch) => input.includes(ch));
    return allPresent ? 0.8 : 0;
  }

  // Level 3: Bigram overlap for longer phrases
  const bigrams: string[] = [];
  for (let i = 0; i < kw.length - 1; i++) {
    bigrams.push(kw.slice(i, i + 2));
  }
  if (bigrams.length === 0) return 0;

  const matched = bigrams.filter((bg) => input.includes(bg)).length;
  return matched / bigrams.length;
}

/**
 * Extract character bigrams from text for fallback matching.
 */
function extractBigrams(text: string): string[] {
  const cleaned = text
    .replace(/[^a-z0-9一-鿿]/g, "")
    .toLowerCase();
  const result: string[] = [];
  for (let i = 0; i < cleaned.length - 1; i++) {
    result.push(cleaned.slice(i, i + 2));
  }
  return [...new Set(result)];
}

/**
 * Polish FAQ content with a specified tone using DeepSeek API.
 * Makes the text more natural, vivid, and conversational.
 */
export async function polishContent(
  content: string,
  tone: string,
  streamerInfo?: Record<string, string>
): Promise<string> {
  if (!deepseek || tone === "natural") {
    return content;
  }

  const contextParts: string[] = [];
  if (streamerInfo?.name) contextParts.push(`对方姓名：${streamerInfo.name}`);
  if (streamerInfo?.age) contextParts.push(`对方年龄：${streamerInfo.age}`);
  if (streamerInfo?.address) contextParts.push(`对方地址：${streamerInfo.address}`);

  const contextStr = contextParts.length > 0
    ? `\n\n对方信息（在话术中自然提及，不要生硬插入）：\n${contextParts.join("\n")}`
    : "";

  const tonePrompts: Record<string, string> = {
    lively:
      "你是一个直播公会经纪人，正在和主播候选人微信聊天。请用自然的口语化表达改写以下话术，语气活泼轻快，像日常聊天一样自然，不要过于夸张，不要加过多表情符号，保持信息准确完整。",
    cute:
      "你是一个直播公会经纪人，正在和主播候选人微信聊天。请用自然的口语化表达改写以下话术，语气亲切温和，像日常聊天一样自然，不要过于可爱夸张，不要加过多叠词和表情符号，保持信息准确完整。",
    professional:
      "你是一个直播公会经纪人，正在和主播候选人微信聊天。请用自然的口语化表达改写以下话术，语气专业得体，但听起来像是真实的人在说话，不要太正式太书面，保持信息准确完整。",
    gentle:
      "你是一个直播公会经纪人，正在和主播候选人微信聊天。请用自然的口语化表达改写以下话术，语气温和贴心，像朋友聊天一样自然舒服，不要过于夸张肉麻，保持信息准确完整。",
  };

  const systemPrompt = tonePrompts[tone] || tonePrompts.lively;

  try {
    const completion = await deepseek.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请润色以下话术：\n\n${content}${contextStr}` },
      ],
      temperature: 0.6,
      max_tokens: 1000,
    });
    const polished = completion.choices[0]?.message?.content?.trim();
    return polished || content;
  } catch (error) {
    console.error("Polishing API error:", error);
    return content;
  }
}

/** Increase weight for a FAQ entry when its suggestion is selected */
export async function boostFAQWeight(faqId: string): Promise<void> {
  await prisma.knowledgeBase.update({
    where: { id: faqId },
    data: { weight: { increment: 1 } },
  });
}

export async function generateContent(
  prompt: string,
  type: "recruitment" | "reply" | "analysis"
): Promise<string> {
  if (!deepseek) {
    return "请先配置 DEEPSEEK_API_KEY 以使用AI内容生成功能。";
  }

  const prompts: Record<string, string> = {
    recruitment: "你是一个直播公会运营专家。请生成一份招募主播的文案，要求有吸引力、突出公会的优势。",
    reply: "你是一个直播公会经纪人。请根据以下内容生成得体的回复：",
    analysis: "你是一个直播行业分析师。请分析以下内容并提供专业见解：",
  };

  try {
    const completion = await deepseek.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: prompts[type] || prompts.recruitment },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });
    return completion.choices[0]?.message?.content || "生成失败，请重试";
  } catch (error) {
    console.error("DeepSeek API error:", error);
    return "AI生成失败，请检查API配置后重试。";
  }
}

function extractKeywords(text: string): string[] {
  // Split Chinese and English text into meaningful keywords
  // Remove punctuation, split by common delimiters
  const cleaned = text
    .replace(/[，。！？、；：""''（）【】《》\s+,.!?;:()\[\]{}<>]/g, " ")
    .trim();
  // For Chinese, use 2+ character segments as keywords
  // For English, use individual words
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const keywords: string[] = [];

  for (const token of tokens) {
    if (/[一-鿿]/.test(token)) {
      // Chinese: add the whole word, plus each character for better matching
      keywords.push(token);
      if (token.length >= 2) {
        // Also add bi-grams for Chinese
        for (let i = 0; i < token.length - 1; i++) {
          keywords.push(token.slice(i, i + 2));
        }
      }
    } else {
      // English/numbers: add as-is (lowercased)
      keywords.push(token.toLowerCase());
      // Also add individual characters for short tokens
      if (token.length <= 3) {
        keywords.push(token.toLowerCase());
      }
    }
  }

  // Deduplicate
  return [...new Set(keywords)];
}
