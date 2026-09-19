const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const basePosts = JSON.parse(fs.readFileSync(path.join(root, 'seed', 'base-posts.json'), 'utf8')).posts;
const regions = JSON.parse(fs.readFileSync(path.join(root, 'client', 'src', 'assets', 'regions.json'), 'utf8'));

const TARGET = 1000;
const GENERATED_PER_TAG = { 健康: 87, 家庭: 87, 工作: 87, 学业: 87, 经济: 88, 信仰: 88, 关系: 88, 平安: 88 };

const TEMPLATES = {
  健康: {
    clauses: [
      '我妈妈查出甲状腺结节，这周要去复查',
      '我爸爸高血压很多年，最近老说头晕',
      '我奶奶前阵子摔了一跤，髋部骨折住院',
      '我丈夫最近查出脂肪肝，医生让他戒酒控制饮食',
      '我妻子胃病反反复复，吃不对就疼一整天',
      '我儿子反复咳嗽快一个月了，药换了几种还是时好时坏',
      '我女儿近视度数涨得很快，一年就涨了一百多度',
      '我自己失眠好几个月，晚上翻来覆去睡不着',
      '我公公中风过一次，恢复期走路还不太稳',
      '我婆婆膝盖疼得厉害，走路都要歇几回',
      '我外婆年纪大了，这几个月食欲越来越差',
      '我弟弟颈椎病犯了，手有时候发麻',
      '我妹妹的耳鸣一直不好，晚上安静下来特别明显',
      '我舅舅体检查出胆囊息肉，医生让定期复查',
      '教会一位老姊妹查出乳腺癌早期，下周要手术',
      '教会一位老弟兄肾脏有些问题，医生建议住院观察'
    ],
    details: [
      '家里人都很担心，也不知道能帮上什么忙',
      '他很要强，不太愿意麻烦别人',
      '我们在外地，只能电话里问问情况',
      '医生说先按这个方案观察一段时间',
      '治疗和复查的费用也让我们有点压力',
      '他自己心里也害怕，只是不太说出来'
    ],
    requests: [
      '求神医治，也让我们一家人心里有平安',
      '求神保守检查和治疗都顺利，让他少受点罪',
      '求神赐他信心和耐心，好好配合医生',
      '求神使用医生和药物，也保守不要出现并发症',
      '求神看顾他的身体，也让我们照顾的人有力量',
      '求神怜悯，让他身体快点好起来，也安慰家里人的心'
    ]
  },
  家庭: {
    clauses: [
      '我和丈夫结婚这些年交流越来越少，下班回来各自看手机',
      '我和妻子因为孩子的教育问题意见不合，常常说着说着就吵起来',
      '我儿子进入青春期后话越来越少，房门一关就是一晚上',
      '我女儿刚上小学，写作业拖拉，辅导的时候大人容易上火',
      '我和公婆住在一起，生活习惯差很多，小事上总有点摩擦',
      '我和妻子两地分居，只有周末才能见面',
      '我爸妈年纪大了还在老家，身体有点小毛病也不肯去医院',
      '今年过年没能回家，父母嘴上说理解，心里还是想我们',
      '孩子住院这几天，全家轮流照顾，人都累瘦了',
      '家里刚添了二胎，晚上睡不好，白天还要上班',
      '我们结婚几年一直没有孩子，两边老人都在催',
      '孩子明年中考，家里气氛绷得很紧，谁都不敢多说话',
      '家里老人去世以后，家里冷清了很多',
      '我和兄弟姐妹因为照顾父母的分工闹了点不愉快',
      '孩子在寄宿学校受了委屈，回家不太愿意说',
      '房贷和生活开销压得紧，我和爱人最近都容易急躁'
    ],
    details: [
      '我们都很爱这个家，只是不知道该怎么开口',
      '大家都累了，一点小事就容易起冲突',
      '我知道自己也有做得不对的地方',
      '我们都很想把这个家经营好',
      '家里老的老、小的小，实在离不开人',
      '这些话平时不太好跟外人讲'
    ],
    requests: [
      '求神帮助我们重新学会好好沟通，让家重新温暖起来',
      '求神给我们智慧和耐心，一起把这个家经营好',
      '求神安慰家里每一个人的心，也让我们彼此体谅',
      '求神保守一家人的身体和情绪，不因琐事伤了感情',
      '求神赐我们信心面对眼前的难处，也让家里多点喜乐',
      '求神看顾老人和孩子，也让我们尽到本分'
    ]
  },
  工作: {
    clauses: [
      '我公司最近在调整组织架构，人心惶惶',
      '我们部门业绩压力很大，领导天天开会加压',
      '我入职新公司快三个月了，很多东西还没上手',
      '我做了几年行政，工资一直没涨，想转行又不知道能做什么',
      '团队里有人总把活推给我，出了错还让我背锅',
      '我做销售，这个月业绩还差很多',
      '公司搬到很远的地方，通勤要两个多小时',
      '我去年被裁员后一直做零工，收入不稳定',
      '领导经常下班后布置任务，周末还要盯着手机回消息',
      '我自己开了一家小店，房租人工都是固定开销',
      '我在厂里三班倒，身体越来越吃不消',
      '我评职称的材料准备了一年，名额只有一个',
      '我经常要出差应酬，喝酒喝到很晚才回家',
      '我连续加班赶项目，改了一版又一版',
      '我们公司效益不好，已经两三个月没发全额工资',
      '我面试了几家公司，到了终面就没消息'
    ],
    details: [
      '家里人都劝我别太拼，可我不敢松下来',
      '这份工作关系到一家人的开销',
      '我知道自己尽力了，心里还是没底',
      '现在这份工作离家近，放弃了又舍不得',
      '同事之间竞争也挺激烈，说话都得小心',
      '我白天忙工作，晚上还想着这些事'
    ],
    requests: [
      '求神保守我的工作，也让我心里有平安',
      '求神赐我智慧应对压力，在工作中见证他的品格',
      '求神为我开一条合适的路，让我的付出有回报',
      '求神加添我力量，也让我懂得平衡工作与家庭',
      '求神看顾我的身体，别让忙碌把健康拖垮',
      '求神给我信心和耐心，无论结果如何都不失去盼望'
    ]
  },
  学业: {
    clauses: [
      '我今年考研二战，在家复习压力很大',
      '我孩子明年高考，模拟考成绩起起伏伏',
      '我大学快毕业了，论文盲审要大改，时间很紧',
      '我女儿中考前一个月，突然说不想上学',
      '我在准备教师资格证面试，试讲一紧张就忘词',
      '我儿子刚上小学一年级，坐不住，写作业拖拖拉拉',
      '我考公进面了，笔试成绩不算高',
      '我在读在职研究生，工作学业两边兼顾',
      '我孩子数学成绩一直上不去，补课费花了不少',
      '我高考发挥不理想，复读和走普通学校家里意见不统一',
      '我学的专业就业前景不好，大二想转专业又怕跟不上',
      '我女儿高三住宿，电话里总说压力大',
      '我在备考注册会计师，科目多、周期长',
      '我孩子上初二，成绩中游，想努力又不知道从哪下手',
      '我准备出国留学，语言成绩还没考出来',
      '我外甥今年参加艺考，文化课基础比较弱'
    ],
    details: [
      '我们既心疼他，又不敢多说什么',
      '家里的气氛也跟着紧张起来',
      '他自己也很想学好，就是找不到方法',
      '这段时间几乎没有什么休息',
      '我们只能在旁边陪着，帮不上太多',
      '投入了很多时间和精力，心里还是有压力'
    ],
    requests: [
      '求神让我沉下心，也给我清楚的思路',
      '求神赐他平静的心，也让我们知道怎么支持他',
      '求神保守身体和情绪，让他发挥出正常水平',
      '求神赐智慧和专注，让这一段辛苦有好的结果',
      '求神除去紧张和焦虑，也让我们坦然面对结果',
      '求神带领前面的方向，让我们做合适的决定'
    ]
  },
  经济: {
    clauses: [
      '我家房贷每个月八千多，上个月工资又降了',
      '我父亲突然重病住院，医药费花了很多',
      '我做小生意，货款被拖欠快一年了',
      '我失业三个月了，每个月还要还车贷',
      '我们刚买了房，装修的钱还没凑够',
      '老家种的柑橘今年价格很低，收购价连本钱都收不回来',
      '我之前被培训机构套路，办了几万块的分期',
      '我老公公司几个月发不出全额工资',
      '我在夜市摆摊，最近客流少了很多',
      '我的信用卡分期越滚越多，每个月工资都不够还',
      '我父母在农村，年纪大了没有养老金',
      '孩子上学、老人药费、房租水电，样样都要钱',
      '我借钱给朋友应急，快一年了还没还',
      '我女儿想学一门乐器，报名费不便宜',
      '我跑网约车养家，平台抽成高，油费也涨了',
      '我开的小店遇到资金周转问题，向亲戚借了一圈还差一些'
    ],
    details: [
      '每天一算账就睡不着觉',
      '家里的开销一样都省不下来',
      '我不敢把这些压力都告诉家里人',
      '我们已经在尽量节省了',
      '就盼着能有个转机',
      '这笔钱对我们家真的很重要'
    ],
    requests: [
      '求神供应我们，让我们能守住这个家',
      '求神为我们开一条供应的路，也让我们量力而行',
      '求神给我智慧理清财务，不被债务压垮',
      '求神看顾我们的需要，也让我们不失去平安',
      '求神帮助我找到稳定的收入，让家人安心',
      '求神赐我智慧处理，也别让钱伤了亲情'
    ]
  },
  信仰: {
    clauses: [
      '我信主几年了，最近祷告觉得特别枯干',
      '我妈妈身体不好，一直还没有信主',
      '我们教会儿童主日学同工不够，孩子越来越多',
      '我丈夫不信主，虽然不拦阻我去聚会，心里不认同',
      '我参加诗班服侍，工作和服侍平衡不好，心也冷淡了',
      '我身边有位同事遇到很大的难处，我试着跟他分享信仰',
      '我们小组最近人越来越少，聚在一起的时间也少了',
      '我最近遭遇一连串不顺，心里很容易抱怨',
      '我女儿在外地上大学，离开家以后很少参加聚会',
      '我们教会准备扩建，资金和手续都有压力',
      '我祷告常常求了很多，却很少安静下来听神说话',
      '家里有人病了以后脾气很大，我照顾得很累',
      '我的读经计划又中断了，每天睡前才想起来',
      '我们小区有几位独居老人，教会想去看望他们',
      '我孩子还小，我希望他从小认识神',
      '我灵修时总走神，祷告几句话就结束了'
    ],
    details: [
      '我知道自己软弱，也不想一直这样下去',
      '这些话我没有跟别人说过',
      '我很想重新回到起初的心里',
      '我心里有个负担，愿意更多地被神使用',
      '求神给我机会，也给我智慧',
      '我一个人常常觉得使不上力'
    ],
    requests: [
      '求神重新挑旺我心里的火，让我重新尝到主的同在',
      '求神柔软他的心，让他有机会认识主',
      '求神感动有负担的人起来服侍，也赐我们智慧',
      '求神借着我生命里的改变让他看见信仰的宝贵',
      '求神恢复我起初的爱，也让我在忙碌中仍有安息',
      '求神教导我祷告，也让我学习安静等候他'
    ]
  },
  关系: {
    clauses: [
      '我和一个很要好的朋友因为借钱的事闹僵了',
      '我和妈妈一打电话就容易吵起来',
      '公司里有个同事总在背后说我',
      '我和妻子冷战一个多星期了',
      '大学室友毕业后各奔东西，最近听说有同学得了重病',
      '我和儿子班主任沟通不太顺畅',
      '楼上邻居半夜经常有声音，沟通过几次还是这样',
      '我和弟弟为了照顾父母的事起了争执',
      '我闺蜜结婚后联系越来越少，约她出来总说忙',
      '我和婆婆见面总不太自然，虽然没吵过',
      '我父亲和我叔叔因为老家宅基地的事多年不说话',
      '我女儿到了青春期，嫌我唠叨，说什么都顶嘴',
      '我和老板之间有点误会，他觉得我态度消极',
      '我妈妈和我嫂子关系不好，家庭聚会气氛紧张',
      '我和多年未见的老同学约了见面',
      '我先生和公婆关系紧张，我夹在中间很为难'
    ],
    details: [
      '其实心里都还惦记着对方',
      '我也不想让这段关系就这么断了',
      '每次想起来心里都不太舒服',
      '我知道自己也有责任',
      '我不想一直带着这股气过日子',
      '有时候一句话就能解开，就是都开不了口'
    ],
    requests: [
      '求神帮助我们放下自尊，也让我们能重新和好',
      '求神让我学会好好说话，也医治我们之间的隔阂',
      '求神给我智慧应对，也让我不被苦毒抓住',
      '求神软化我们的心，让我们早点恢复沟通',
      '求神修复这段关系，也让我们彼此真诚相待',
      '求神让我有爱心也有界限，合宜地对待身边的人'
    ]
  },
  平安: {
    clauses: [
      '我爸爸下周要一个人开车回老家，路程七百多公里',
      '我经常上夜班，凌晨两点才能到家',
      '台风这几天就要来了，家里窗户有点老化',
      '孩子暑假报了游泳班，我心里总不踏实',
      '今年雨下得大，老家地势低，父母担心汛情',
      '我下周要坐飞机出差，是第一次坐飞机',
      '我奶奶一个人住，我每天打电话确认她平安',
      '我家小区附近最近发生过几起盗窃',
      '我丈夫经常跑长途运输，一周有好几天在路上',
      '我儿子每天骑车上下学，路上车很多',
      '我经常加班到很晚，坐末班地铁回家',
      '冬天家里取暖设备用得多，我每晚睡前都要检查一遍',
      '我在工业园区上班，附近货车很多，事故频发',
      '我弟弟刚学会骑电动车，骑得有点快',
      '我们小区门口在修路，车多、人多',
      '最近降温，孩子学校流感比较多，班里请假了好几个'
    ],
    details: [
      '我嘴上不说，心里其实一直悬着',
      '家里人也都不太放心',
      '我们能做的都做了，剩下的只能交托',
      '这种事不好多说，只能放在祷告里',
      '我每天都要确认一遍才安心',
      '一次意外对一个家影响就很大'
    ],
    requests: [
      '求神保守一路平安，也保守路上的每一个人',
      '求神保守出入平安，也让家里人放心',
      '求神看顾这一带的平安，也让我们有智慧防备',
      '求神保守身体的平安，也安慰挂念的人',
      '求神让每一天的路程都平平安安，也让我心里有安息',
      '求神保护孩子和老人，也让周围的人都有责任心'
    ]
  }
};

const NICKNAMES = [
  '恩典', '以马内利', '平安喜乐', '活水', '晨光', '佳音', '守望者', '小羊',
  '橄榄枝', '喜乐的心', '溪水旁', '云彩', '微光', '盼望', '新生', '蒙福之家',
  '一粒麦子', '真光', '安息', '归回', '清心', '行道者', '颂恩', '迦南',
  '客旅', '清晨的露', '旷野吗哪', '仰望', '安静', '感恩'
];

const cityPool = [];
for (const province of Object.keys(regions)) {
  for (const city of Object.keys(regions[province])) {
    const districts = regions[province][city];
    if (!Array.isArray(districts) || districts.length === 0) continue;
    cityPool.push({ province, city, districts });
  }
}

function contentFor(tag, count) {
  const template = TEMPLATES[tag];
  const seen = new Set();
  const out = [];
  const cycle = template.clauses.length * template.details.length * template.requests.length;
  for (let i = 0; out.length < count && i < cycle; i++) {
    const clause = template.clauses[i % template.clauses.length];
    const detail = template.details[Math.floor(i / template.clauses.length) % template.details.length];
    const request = template.requests[Math.floor(i / (template.clauses.length * template.details.length)) % template.requests.length];
    const text = `${clause}，${detail}。${request}。`;
    if (seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  if (out.length < count) throw new Error(`${tag} 模板不足，仅生成 ${out.length} 条`);
  return out;
}

const posts = [];
for (const post of basePosts) {
  const provincesCities = regions[post.province] || {};
  let city = post.city;
  if (!provincesCities[city] && provincesCities['市辖区']) city = '市辖区';
  posts.push({ ...post, city, tags: [...post.tags] });
}

let cursor = 0;
for (const tag of Object.keys(GENERATED_PER_TAG)) {
  const contents = contentFor(tag, GENERATED_PER_TAG[tag]);
  for (const content of contents) {
    const spot = cityPool[cursor % cityPool.length];
    const district = spot.districts[(cursor * 7 + 3) % spot.districts.length];
    posts.push({
      content,
      nickname: NICKNAMES[cursor % NICKNAMES.length],
      province: spot.province,
      city: spot.city,
      district,
      tags: [tag],
      createdDaysAgo: (cursor % 29) + 1,
      prayCount: (cursor % 47) + 2
    });
    cursor++;
  }
}

if (posts.length !== TARGET) throw new Error(`目标 ${TARGET} 条，实际 ${posts.length} 条`);

const problems = [];
const seenContent = new Map();
for (const [index, post] of posts.entries()) {
  const previous = seenContent.get(post.content);
  if (previous !== undefined) problems.push(`内容重复：第 ${previous + 1} 条与第 ${index + 1} 条`);
  seenContent.set(post.content, index);

  const provinceCities = regions[post.province];
  if (!provinceCities) { problems.push(`省份无效：${post.province}`); continue; }
  const districts = provinceCities[post.city];
  if (!districts) { problems.push(`城市无效：${post.province}/${post.city}`); continue; }
  if (post.district && !districts.includes(post.district)) {
    problems.push(`区县无效：${post.province}/${post.city}/${post.district}`);
  }
}
if (problems.length) {
  console.error('数据校验失败：');
  for (const problem of problems.slice(0, 20)) console.error('  ' + problem);
  process.exit(1);
}

const tagCounts = {};
const provinceCounts = {};
for (const post of posts) {
  tagCounts[post.tags[0]] = (tagCounts[post.tags[0]] || 0) + 1;
  provinceCounts[post.province] = (provinceCounts[post.province] || 0) + 1;
}

console.log('总条数:', posts.length);
console.log('标签分布:', JSON.stringify(tagCounts));
console.log('覆盖省级地区:', Object.keys(provinceCounts).length, '/', Object.keys(regions).length);
console.log('覆盖城市:', new Set(posts.map((p) => `${p.province}/${p.city}`)).size, '/', cityPool.length);
console.log('最少省份条数:', Math.min(...Object.values(provinceCounts)));
fs.writeFileSync(path.join(root, 'seed', 'prayer-posts.json'), JSON.stringify({ posts }, null, 2), 'utf8');
console.log('已写入 seed/prayer-posts.json');
