import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  try {
    // Check if already seeded
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      return NextResponse.json({
        message: "数据库已有数据",
        users: existingUsers,
        seeded: true,
      });
    }

    // Create users
    const adminPassword = await hashPassword("admin123");
    await prisma.user.create({
      data: {
        username: "admin",
        password: adminPassword,
        name: "管理员",
        role: "admin",
      },
    });

    const brokerPassword = await hashPassword("broker123");
    await prisma.user.create({
      data: {
        username: "broker",
        password: brokerPassword,
        name: "经纪人小王",
        role: "broker",
      },
    });

    // Create FAQs
    const faqs = [
      { category: "recruitment", question: "你们公会有什么优势？", answer: "我们公会拥有丰富的平台资源、专业的运营团队和成熟的培训体系。提供从零基础到专业主播的全流程培训，包括形象打造、内容策划、流量扶持等。合作主播平均月收入提升50%以上。", keywords: "优势,公会,资源,培训,扶持" },
      { category: "recruitment", question: "主播的收益怎么分成？", answer: "我们采用灵活的分成模式，新主播享有保护期高分成比例，最高可达70%。随着主播成长和贡献提升，分成比例会逐步优化。此外还有多种激励政策和额外奖励机制。", keywords: "收益,分成,比例,奖励" },
      { category: "recruitment", question: "没有直播经验可以吗？", answer: "完全没问题！我们有专业的培训团队，从零基础开始教学，包括直播技巧、互动话术、内容策划等全方位的培训课程。很多现在收入可观的主播都是从零开始的。", keywords: "经验,零基础,培训,新手" },
      { category: "recruitment", question: "每天需要直播多长时间？", answer: "建议每天直播2-4小时，具体时长可以根据个人情况灵活安排。我们更注重直播质量和粉丝互动，而不是单纯追求时长。运营团队会根据你的情况制定个性化的直播计划。", keywords: "时长,时间,直播时长,安排" },
      { category: "recruitment", question: "公会提供哪些扶持？", answer: "我们提供全方位的扶持：1. 流量扶持 - 平台推荐位、热门资源；2. 内容扶持 - 专业策划团队定制内容；3. 培训扶持 - 资深主播一对一指导；4. 设备扶持 - 直播间搭建建议和设备支持；5. 运营扶持 - 数据分析、粉丝运营等。", keywords: "扶持,资源,流量,培训,设备" },
      { category: "platform-rule", question: "抖音直播有哪些违规行为？", answer: "抖音直播严禁：涉政涉黄涉暴内容、虚假宣传、诱导消费、刷单刷量、私下交易导流、侵犯他人权益等。违规将面临警告、限流、封禁等处罚。", keywords: "抖音,违规,封禁,规则" },
      { category: "platform-rule", question: "平台对主播有哪些资质要求？", answer: "主播需年满18周岁，完成实名认证。部分特殊内容类目需要额外资质认证。公会入驻需提供营业执照等相关资质文件。", keywords: "资质,要求,认证,年龄" },
      { category: "op-skill", question: "如何提升直播间人气？", answer: "提升人气的方法：1. 固定直播时间培养粉丝习惯；2. 优化直播封面和标题；3. 增加互动环节；4. 与其他主播联动；5. 利用短视频引流；6. 参与平台活动。", keywords: "人气,提升,流量,互动,直播间" },
      { category: "op-skill", question: "主播如何维护粉丝关系？", answer: "粉丝维护技巧：1. 记住常来粉丝的名字和喜好；2. 定期举办粉丝福利活动；3. 建立粉丝群加强互动；4. 及时回应评论和礼物；5. 保持真实自然的直播风格。", keywords: "粉丝,维护,关系,互动,群" },
      { category: "industry-data", question: "目前直播行业的发展趋势？", answer: "直播行业持续增长，市场规模已突破5000亿元。趋势包括：直播电商持续发力、内容垂直化精细化、AI技术深度应用、虚拟主播兴起、跨境直播新机遇。", keywords: "趋势,行业,发展,市场" },
      { category: "general", question: "公会和主播的合作模式是怎样的？", answer: "我们采用灵活的合作模式，包括签约制和合作制两种。签约主播享有更高的分成比例和更多资源扶持，合作主播则更加自由灵活。", keywords: "合作,模式,签约,合作制" },
      { category: "recruitment", question: "你们的公会叫什么名字？", answer: "我们公会叫「星辰传媒」，是抖音平台的优质公会，拥有多年的主播孵化和运营经验。公会旗下现有签约主播200+，覆盖才艺、游戏、带货等多个品类。", keywords: "公会,名字,星辰,传媒" },
    ];

    for (const faq of faqs) {
      await prisma.knowledgeBase.create({ data: faq });
    }

    return NextResponse.json({
      message: "数据库初始化完成！",
      users: 2,
      faqs: faqs.length,
      accounts: [
        { username: "admin", password: "admin123", role: "管理员" },
        { username: "broker", password: "broker123", role: "经纪人" },
      ],
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "初始化失败" }, { status: 500 });
  }
}
