export interface CityMeta {
  key: string       // Globalping 匹配键 / 拼音 (如 'Chongqing')
  nameZh: string    // 中文名 (如 '重庆')
  province: string  // 所属省份 (如 '重庆市')
  region: string    // 所属大区 (如 '西南中心', '西北中心', '华中中心', '华北中心', '华东中心', '华南中心', '东北地区')
}

/**
 * 官方推荐默认保底枢纽中心（12 城市，100% 每次必保底）
 */
export const DEFAULT_GUARANTEED_HUB_CITIES: string[] = [
  // 西南中心
  'Chongqing', // 重庆 (直辖市)
  'Chengdu',   // 成都 (四川省会/西南中心)
  'Kunming',   // 昆明 (云南省会/西南枢纽)
  // 西北中心
  "Xi'an",     // 西安 (陕西省会/西北枢纽)
  // 华中中心
  'Wuhan',     // 武汉 (湖北省会/华中枢纽)
  'Changsha',  // 长沙 (湖南省会/华中中心)
  // 华北中心
  'Beijing',   // 北京 (国家中心/华北枢纽)
  'Tianjin',   // 天津 (直辖市/华北枢纽)
  // 华东中心
  'Shanghai',  // 上海 (国家中心/华东枢纽)
  'Nanjing',   // 南京 (江苏省会/华东中心)
  'Ningbo',    // 宁波 (浙江核心沿海港口)
  // 华南中心
  'Guangzhou', // 广州 (广东省会/华南中心)
]

/**
 * 官方推荐默认轮换候选池（中国大陆各省会与重点经济城市，排除西藏、新疆、内蒙古及 12 个必选核心城市）
 */
export const DEFAULT_ROTATION_CANDIDATES: string[] = [
  // 1. Globalping 社区活跃在线探针城市
  'Shenzhen',
  'Wuxi',
  'Zhenjiang',
  'Yancheng',
  'Taishan',
  'Dongguan',
  'Shiyan',

  // 2. 华东地区其他主要城市
  'Hangzhou',
  'Suzhou',
  'Hefei',
  'Fuzhou',
  'Xiamen',
  'Nanchang',
  'Jinan',
  'Qingdao',
  'Wenzhou',
  'Jiaxing',

  // 3. 华北 / 东北主要城市
  'Shijiazhuang',
  'Taiyuan',
  'Shenyang',
  'Dalian',
  'Changchun',
  'Harbin',

  // 4. 华中 / 华南其他主要城市
  'Zhengzhou',
  'Nanning',
  'Guiyang',
  'Haikou',
  'Sanya',
  'Foshan',
  'Zhongshan',
  'Zhuhai',

  // 5. 西北其他中心
  'Lanzhou',
  'Yinchuan',
  'Xining',
]

/**
 * 所有已知主要城市的元数据字典（中文名、大区、省份）
 */
export const CITY_METADATA_MAP: Record<string, CityMeta> = {
  // 西南中心
  Chongqing: { key: 'Chongqing', nameZh: '重庆', province: '重庆市', region: '西南中心' },
  Chengdu: { key: 'Chengdu', nameZh: '成都', province: '四川省', region: '西南中心' },
  Kunming: { key: 'Kunming', nameZh: '昆明', province: '云南省', region: '西南中心' },
  Guiyang: { key: 'Guiyang', nameZh: '贵阳', province: '贵州省', region: '西南中心' },

  // 西北中心
  "Xi'an": { key: "Xi'an", nameZh: '西安', province: '陕西省', region: '西北中心' },
  Lanzhou: { key: 'Lanzhou', nameZh: '兰州', province: '甘肃省', region: '西北中心' },
  Yinchuan: { key: 'Yinchuan', nameZh: '银川', province: '宁夏', region: '西北中心' },
  Xining: { key: 'Xining', nameZh: '西宁', province: '青海省', region: '西北中心' },

  // 华中中心
  Wuhan: { key: 'Wuhan', nameZh: '武汉', province: '湖北省', region: '华中中心' },
  Changsha: { key: 'Changsha', nameZh: '长沙', province: '湖南省', region: '华中中心' },
  Zhengzhou: { key: 'Zhengzhou', nameZh: '郑州', province: '河南省', region: '华中中心' },
  Shiyan: { key: 'Shiyan', nameZh: '十堰', province: '湖北省', region: '华中中心' },

  // 华北中心
  Beijing: { key: 'Beijing', nameZh: '北京', province: '北京市', region: '华北中心' },
  Tianjin: { key: 'Tianjin', nameZh: '天津', province: '天津市', region: '华北中心' },
  Shijiazhuang: { key: 'Shijiazhuang', nameZh: '石家庄', province: '河北省', region: '华北中心' },
  Taiyuan: { key: 'Taiyuan', nameZh: '太原', province: '山西省', region: '华北中心' },

  // 华东中心
  Shanghai: { key: 'Shanghai', nameZh: '上海', province: '上海市', region: '华东中心' },
  Nanjing: { key: 'Nanjing', nameZh: '南京', province: '江苏省', region: '华东中心' },
  Ningbo: { key: 'Ningbo', nameZh: '宁波', province: '浙江省', region: '华东中心' },
  Hangzhou: { key: 'Hangzhou', nameZh: '杭州', province: '浙江省', region: '华东中心' },
  Suzhou: { key: 'Suzhou', nameZh: '苏州', province: '江苏省', region: '华东中心' },
  Wuxi: { key: 'Wuxi', nameZh: '无锡', province: '江苏省', region: '华东中心' },
  Zhenjiang: { key: 'Zhenjiang', nameZh: '镇江', province: '江苏省', region: '华东中心' },
  Yancheng: { key: 'Yancheng', nameZh: '盐城', province: '江苏省', region: '华东中心' },
  Hefei: { key: 'Hefei', nameZh: '合肥', province: '安徽省', region: '华东中心' },
  Fuzhou: { key: 'Fuzhou', nameZh: '福州', province: '福建省', region: '华东中心' },
  Xiamen: { key: 'Xiamen', nameZh: '厦门', province: '福建省', region: '华东中心' },
  Nanchang: { key: 'Nanchang', nameZh: '南昌', province: '江西省', region: '华东中心' },
  Jinan: { key: 'Jinan', nameZh: '济南', province: '山东省', region: '华东中心' },
  Qingdao: { key: 'Qingdao', nameZh: '青岛', province: '山东省', region: '华东中心' },
  Wenzhou: { key: 'Wenzhou', nameZh: '温州', province: '浙江省', region: '华东中心' },
  Jiaxing: { key: 'Jiaxing', nameZh: '嘉兴', province: '浙江省', region: '华东中心' },

  // 华南中心
  Guangzhou: { key: 'Guangzhou', nameZh: '广州', province: '广东省', region: '华南中心' },
  Shenzhen: { key: 'Shenzhen', nameZh: '深圳', province: '广东省', region: '华南中心' },
  Taishan: { key: 'Taishan', nameZh: '台山', province: '广东省', region: '华南中心' },
  Dongguan: { key: 'Dongguan', nameZh: '东莞', province: '广东省', region: '华南中心' },
  Foshan: { key: 'Foshan', nameZh: '佛山', province: '广东省', region: '华南中心' },
  Zhongshan: { key: 'Zhongshan', nameZh: '中山', province: '广东省', region: '华南中心' },
  Zhuhai: { key: 'Zhuhai', nameZh: '珠海', province: '广东省', region: '华南中心' },
  Nanning: { key: 'Nanning', nameZh: '南宁', province: '广西', region: '华南中心' },
  Haikou: { key: 'Haikou', nameZh: '海口', province: '海南省', region: '华南中心' },
  Sanya: { key: 'Sanya', nameZh: '三亚', province: '海南省', region: '华南中心' },

  // 东北地区
  Shenyang: { key: 'Shenyang', nameZh: '沈阳', province: '辽宁省', region: '东北地区' },
  Dalian: { key: 'Dalian', nameZh: '大连', province: '辽宁省', region: '东北地区' },
  Changchun: { key: 'Changchun', nameZh: '长春', province: '吉林省', region: '东北地区' },
  Harbin: { key: 'Harbin', nameZh: '哈尔滨', province: '黑龙江省', region: '东北地区' },
}

/**
 * 获取或补全城市元数据
 */
export function getCityMeta(key: string): CityMeta {
  if (CITY_METADATA_MAP[key]) {
    return CITY_METADATA_MAP[key]
  }
  return {
    key,
    nameZh: key,
    province: '其他省份',
    region: '其他地区',
  }
}
