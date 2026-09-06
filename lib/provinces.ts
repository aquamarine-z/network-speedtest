// 城市到省份映射（纯函数，无 Node.js 模块依赖，可安全在浏览器与服务端共用）
export function mapCityToProvince(city: string): string {
  if (!city) return '其他'
  const c = city.toLowerCase().trim()

  // 1. 直辖市
  if (c.includes('beijing') || c.includes('北京')) return '北京市'
  if (c.includes('shanghai') || c.includes('上海')) return '上海市'
  if (c.includes('tianjin') || c.includes('天津')) return '天津市'
  if (c.includes('chongqing') || c.includes('重庆')) return '重庆市'

  // 2. 华东地区
  if (
    c.includes('hangzhou') || c.includes('ningbo') || c.includes('wenzhou') ||
    c.includes('jiaxing') || c.includes('huzhou') || c.includes('shaoxing') ||
    c.includes('jinhua') || c.includes('quzhou') || c.includes('zhoushan') ||
    c.includes('taizhou') || c.includes('lishui') || c.includes('yiwu') ||
    c.includes('浙江') || c.includes('杭州') || c.includes('宁波') || c.includes('温州') ||
    c.includes('嘉兴') || c.includes('湖州') || c.includes('绍兴') || c.includes('金华') ||
    c.includes('义乌')
  ) {
    return '浙江省'
  }

  if (
    c.includes('nanjing') || c.includes('suzhou') || c.includes('wuxi') ||
    c.includes('changzhou') || c.includes('nantong') || c.includes('xuzhou') ||
    c.includes('yancheng') || c.includes('yangzhou') || c.includes('zhenjiang') ||
    c.includes('huaian') || c.includes('lianyungang') || c.includes('suqian') ||
    c.includes('kunshan') || c.includes('jiangyin') || c.includes('changshu') ||
    c.includes('江苏') || c.includes('南京') || c.includes('苏州') || c.includes('无锡') ||
    c.includes('常州') || c.includes('南通') || c.includes('徐州') || c.includes('盐城') ||
    c.includes('扬州') || c.includes('镇江') || c.includes('淮安') || c.includes('连云港') ||
    c.includes('宿迁') || c.includes('昆山')
  ) {
    return '江苏省'
  }

  if (
    c.includes('hefei') || c.includes('wuhu') || c.includes('bengbu') ||
    c.includes('huainan') || c.includes('maanshan') || c.includes('huaibei') ||
    c.includes('tongling') || c.includes('anqing') || c.includes('huangshan') ||
    c.includes('chuzhou') || c.includes('fuyang') || c.includes('chizhou') ||
    c.includes('xuancheng') || c.includes('lu\'an') || c.includes('luan') ||
    c.includes('bozhou') || c.includes('安徽') || c.includes('合肥') || c.includes('芜湖')
  ) {
    return '安徽省'
  }

  if (
    c.includes('fuzhou') || c.includes('xiamen') || c.includes('putian') ||
    c.includes('sanming') || c.includes('quanzhou') || c.includes('zhangzhou') ||
    c.includes('nanping') || c.includes('longyan') || c.includes('ningde') ||
    c.includes('福建') || c.includes('福州') || c.includes('厦门') || c.includes('泉州')
  ) {
    return '福建省'
  }

  if (
    c.includes('nanchang') || c.includes('jingdezhen') || c.includes('pingxiang') ||
    c.includes('jiujiang') || c.includes('xinyu') || c.includes('yingtan') ||
    c.includes('ganzhou') || c.includes('ji\'an') || c.includes('jian') ||
    c.includes('yichun') || c.includes('shangrao') || c.includes('江西') ||
    c.includes('南昌') || c.includes('九江') || c.includes('赣州')
  ) {
    return '江西省'
  }

  if (
    c.includes('jinan') || c.includes('qingdao') || c.includes('zibo') ||
    c.includes('zaozhuang') || c.includes('dongying') || c.includes('yantai') ||
    c.includes('weifang') || c.includes('jining') || c.includes('taian') ||
    c.includes('weihai') || c.includes('rizhao') || c.includes('linyi') ||
    c.includes('dezhou') || c.includes('liaocheng') || c.includes('binzhou') ||
    c.includes('heze') || c.includes('山东') || c.includes('济南') || c.includes('青岛') ||
    c.includes('烟台') || c.includes('潍坊') || c.includes('威海')
  ) {
    return '山东省'
  }

  // 3. 华南地区
  if (
    c.includes('guangzhou') || c.includes('shenzhen') || c.includes('dongguan') ||
    c.includes('foshan') || c.includes('zhongshan') || c.includes('zhuhai') ||
    c.includes('huizhou') || c.includes('jiangmen') || c.includes('shantou') ||
    c.includes('zhanjiang') || c.includes('maoming') || c.includes('zhaoqing') ||
    c.includes('qingyuan') || c.includes('meizhou') || c.includes('shanwei') ||
    c.includes('heyuan') || c.includes('yangjiang') || c.includes('chaozhou') ||
    c.includes('jieyang') || c.includes('yunfu') || c.includes('taishan') ||
    c.includes('shunde') || c.includes('广东') || c.includes('广州') || c.includes('深圳') ||
    c.includes('东莞') || c.includes('佛山') || c.includes('珠海') || c.includes('中山') ||
    c.includes('惠州') || c.includes('台山')
  ) {
    return '广东省'
  }

  if (
    c.includes('nanning') || c.includes('liuzhou') || c.includes('guilin') ||
    c.includes('wuzhou') || c.includes('beihai') || c.includes('fangchenggang') ||
    c.includes('qinzhou') || c.includes('guigang') || c.includes('yulin') ||
    c.includes('baise') || c.includes('hezhou') || c.includes('hechi') ||
    c.includes('laibin') || c.includes('chongzuo') || c.includes('广西') ||
    c.includes('南宁') || c.includes('桂林') || c.includes('柳州') || c.includes('北海')
  ) {
    return '广西壮族自治区'
  }

  if (
    c.includes('haikou') || c.includes('sanya') || c.includes('sansha') ||
    c.includes('danzhou') || c.includes('海南') || c.includes('海口') || c.includes('三亚')
  ) {
    return '海南省'
  }

  // 4. 华中地区
  if (
    c.includes('wuhan') || c.includes('huangshi') || c.includes('shiyan') ||
    c.includes('yichang') || c.includes('xiangyang') || c.includes('ezhou') ||
    c.includes('jingmen') || c.includes('xiaogan') || c.includes('jingzhou') ||
    c.includes('huanggang') || c.includes('xianning') || c.includes('suizhou') ||
    c.includes('enshi') || c.includes('xiantao') || c.includes('湖北') ||
    c.includes('武汉') || c.includes('宜昌') || c.includes('十堰') || c.includes('襄阳')
  ) {
    return '湖北省'
  }

  if (
    c.includes('changsha') || c.includes('zhuzhou') || c.includes('xiangtan') ||
    c.includes('hengyang') || c.includes('shaoyang') || c.includes('yueyang') ||
    c.includes('changde') || c.includes('zhangjiajie') || c.includes('yiyang') ||
    c.includes('chenzhou') || c.includes('yongzhou') || c.includes('huaihua') ||
    c.includes('loudi') || c.includes('xiangxi') || c.includes('湖南') ||
    c.includes('长沙') || c.includes('株洲') || c.includes('湘潭') || c.includes('衡阳') ||
    c.includes('张家界')
  ) {
    return '湖南省'
  }

  if (
    c.includes('zhengzhou') || c.includes('kaifeng') || c.includes('luoyang') ||
    c.includes('pingdingshan') || c.includes('anyang') || c.includes('hebi') ||
    c.includes('xinxiang') || c.includes('jiaozuo') || c.includes('puyang') ||
    c.includes('xuchang') || c.includes('luohe') || c.includes('sanmenxia') ||
    c.includes('nanyang') || c.includes('shangqiu') || c.includes('xinyang') ||
    c.includes('zhoukou') || c.includes('zhumadian') || c.includes('jiyuan') ||
    c.includes('河南') || c.includes('郑州') || c.includes('洛阳') || c.includes('开封')
  ) {
    return '河南省'
  }

  // 5. 华北地区
  if (
    c.includes('shijiazhuang') || c.includes('tangshan') || c.includes('qinhuangdao') ||
    c.includes('handan') || c.includes('xingtai') || c.includes('baoding') ||
    c.includes('zhangjiakou') || c.includes('chengde') || c.includes('cangzhou') ||
    c.includes('langfang') || c.includes('hengshui') || c.includes('xiongan') ||
    c.includes('河北') || c.includes('石家庄') || c.includes('唐山') || c.includes('保定')
  ) {
    return '河北省'
  }

  if (
    c.includes('taiyuan') || c.includes('datong') || c.includes('yangquan') ||
    c.includes('changzhi') || c.includes('jincheng') || c.includes('shuozhou') ||
    c.includes('jinzhong') || c.includes('yuncheng') || c.includes('xinzhou') ||
    c.includes('linfen') || c.includes('lvliang') || c.includes('山西') ||
    c.includes('太原') || c.includes('大同')
  ) {
    return '山西省'
  }

  if (
    c.includes('hohhot') || c.includes('baotou') || c.includes('wuhai') ||
    c.includes('chifeng') || c.includes('tongliao') || c.includes('ordos') ||
    c.includes('hulunbuir') || c.includes('bayannur') || c.includes('ulanqab') ||
    c.includes('hinggan') || c.includes('xilingol') || c.includes('alxa') ||
    c.includes('inner mongolia') || c.includes('内蒙古') || c.includes('呼和浩特') ||
    c.includes('包头') || c.includes('鄂尔多斯')
  ) {
    return '内蒙古自治区'
  }

  // 6. 西南地区
  if (
    c.includes('chengdu') || c.includes('mianyang') || c.includes('zigong') ||
    c.includes('panzhihua') || c.includes('luzhou') || c.includes('deyang') ||
    c.includes('guangyuan') || c.includes('suining') || c.includes('neijiang') ||
    c.includes('leshan') || c.includes('nanchong') || c.includes('meishan') ||
    c.includes('yibin') || c.includes('guang\'an') || c.includes('dazhou') ||
    c.includes('ya\'an') || c.includes('bazhong') || c.includes('ziyang') ||
    c.includes('四川') || c.includes('成都') || c.includes('绵阳') || c.includes('乐山')
  ) {
    return '四川省'
  }

  if (
    c.includes('guiyang') || c.includes('liupanshui') || c.includes('zunyi') ||
    c.includes('anshun') || c.includes('bijie') || c.includes('tongren') ||
    c.includes('贵州') || c.includes('贵阳') || c.includes('遵义')
  ) {
    return '贵州省'
  }

  if (
    c.includes('kunming') || c.includes('qujing') || c.includes('yuxi') ||
    c.includes('baoshan') || c.includes('zhaotong') || c.includes('lijiang') ||
    c.includes('pu\'er') || c.includes('lincang') || c.includes('dali') ||
    c.includes('xishuangbanna') || c.includes('云南') || c.includes('昆明') ||
    c.includes('大理') || c.includes('丽江')
  ) {
    return '云南省'
  }

  if (
    c.includes('lhasa') || c.includes('shigatse') || c.includes('chamdo') ||
    c.includes('nyingchi') || c.includes('shannan') || c.includes('naqu') ||
    c.includes('ngari') || c.includes('tibet') || c.includes('西藏') || c.includes('拉萨')
  ) {
    return '西藏自治区'
  }

  // 7. 西北地区
  if (
    c.includes('xi\'an') || c.includes('xian') || c.includes('tongchuan') ||
    c.includes('baoji') || c.includes('xianyang') || c.includes('weinan') ||
    c.includes('yan\'an') || c.includes('hanzhong') || c.includes('yulin') ||
    c.includes('ankang') || c.includes('shangluo') || c.includes('陕西') ||
    c.includes('西安') || c.includes('咸阳') || c.includes('宝鸡') || c.includes('延安')
  ) {
    return '陕西省'
  }

  if (
    c.includes('lanzhou') || c.includes('jiayuguan') || c.includes('jinchang') ||
    c.includes('baiyin') || c.includes('tianshui') || c.includes('wuwei') ||
    c.includes('zhangye') || c.includes('pingliang') || c.includes('jiuquan') ||
    c.includes('qingyang') || c.includes('dingxi') || c.includes('longnan') ||
    c.includes('甘肃') || c.includes('兰州') || c.includes('酒泉') || c.includes('敦煌')
  ) {
    return '甘肃省'
  }

  if (
    c.includes('xining') || c.includes('haidong') || c.includes('haibei') ||
    c.includes('huangnan') || c.includes('haixi') || c.includes('青海') || c.includes('西宁')
  ) {
    return '青海省'
  }

  if (
    c.includes('yinchuan') || c.includes('shizuishan') || c.includes('wuzhong') ||
    c.includes('guyuan') || c.includes('zhongwei') || c.includes('宁夏') || c.includes('银川')
  ) {
    return '宁夏回族自治区'
  }

  if (
    c.includes('urumqi') || c.includes('urumuqi') || c.includes('karamay') ||
    c.includes('turpan') || c.includes('hami') || c.includes('changji') ||
    c.includes('aksu') || c.includes('kashgar') || c.includes('hotan') ||
    c.includes('ili') || c.includes('xinjiang') || c.includes('新疆') || c.includes('乌鲁木齐')
  ) {
    return '新疆维吾尔自治区'
  }

  // 8. 东北地区
  if (
    c.includes('shenyang') || c.includes('dalian') || c.includes('anshan') ||
    c.includes('fushun') || c.includes('benxi') || c.includes('dandong') ||
    c.includes('jinzhou') || c.includes('yingkou') || c.includes('fuxin') ||
    c.includes('liaoyang') || c.includes('panjin') || c.includes('tieling') ||
    c.includes('chaoyang') || c.includes('huludao') || c.includes('辽宁') ||
    c.includes('沈阳') || c.includes('大连') || c.includes('鞍山')
  ) {
    return '辽宁省'
  }

  if (
    c.includes('changchun') || c.includes('jilin') || c.includes('siping') ||
    c.includes('liaoyuan') || c.includes('tonghua') || c.includes('baishan') ||
    c.includes('songyuan') || c.includes('baicheng') || c.includes('yanbian') ||
    c.includes('吉林') || c.includes('长春')
  ) {
    return '吉林省'
  }

  if (
    c.includes('harbin') || c.includes('qiqihar') || c.includes('jixi') ||
    c.includes('hegang') || c.includes('shuangyashan') || c.includes('daqing') ||
    c.includes('yichun') || c.includes('jiamusi') || c.includes('qitaihe') ||
    c.includes('mudanjiang') || c.includes('heihe') || c.includes('suihua') ||
    c.includes('daxinganling') || c.includes('黑龙江') || c.includes('哈尔滨') ||
    c.includes('大庆') || c.includes('齐齐哈尔')
  ) {
    return '黑龙江省'
  }

  // 9. 港澳台特别行政区
  if (c.includes('hong kong') || c.includes('hongkong') || c.includes('香港')) return '香港特别行政区'
  if (c.includes('macao') || c.includes('macau') || c.includes('澳门')) return '澳门特别行政区'
  if (c.includes('taiwan') || c.includes('taipei') || c.includes('台湾') || c.includes('台北')) return '台湾省'

  // 无匹配项返回 '其他'，绝不胡乱默认为北京市
  return '其他'
}

/**
 * 中国各省份中心/省会经纬度坐标字典 [经度, 纬度]
 */
export const PROVINCE_COORDINATES: Record<string, [number, number]> = {
  '北京市': [116.4, 39.9],
  '天津市': [117.2, 39.12],
  '上海市': [121.47, 31.23],
  '重庆市': [106.55, 29.56],
  '河北省': [114.51, 38.04],
  '山西省': [112.55, 37.87],
  '内蒙古自治区': [111.75, 40.84],
  '辽宁省': [123.43, 41.8],
  '吉林省': [125.32, 43.89],
  '黑龙江省': [126.66, 45.74],
  '江苏省': [118.78, 32.06],
  '浙江省': [120.15, 30.28],
  '安徽省': [117.28, 31.86],
  '福建省': [119.3, 26.08],
  '江西省': [115.89, 28.68],
  '山东省': [117.02, 36.67],
  '河南省': [113.63, 34.75],
  '湖北省': [114.31, 30.59],
  '湖南省': [112.98, 28.19],
  '广东省': [113.26, 23.13],
  '广西壮族自治区': [108.33, 22.82],
  '海南省': [110.33, 20.02],
  '四川省': [104.07, 30.67],
  '贵州省': [106.71, 26.57],
  '云南省': [102.71, 25.04],
  '西藏自治区': [91.13, 29.66],
  '陕西省': [108.95, 34.27],
  '甘肃省': [103.82, 36.06],
  '青海省': [101.78, 36.62],
  '宁夏回族自治区': [106.27, 38.47],
  '新疆维吾尔自治区': [87.62, 43.82],
  '香港特别行政区': [114.17, 22.32],
  '澳门特别行政区': [113.54, 22.19],
  '台湾省': [121.51, 25.05],
}

