# Dashscope CLI

## Features

- [x] 支持通义千问 API
- [ ] 其余 dashscope 支持的大语言模型
- [ ] 其余图片生成
- [ ] 其余语音生成
- [ ] 其余视频生成

## Installation

```sh
npm i @jacksontian/dashscope -g
```

After installed the package, there is a command `ds` will be available.

When you run `ds` first, it will query you input `api_key` and choose a `model`.

### Billing

Using this tool may incur fees. The billing detail please according to pricing document.

模型计费文档请参考：<https://dashscope.console.aliyun.com/billing>。可以通过使用免费的额度或者限时免费的模型，您可以免费拥有通义千问作为智能助手。

如果后续有询价接口，工具将在启动时告知费用/额度情况，避免费用产生。

## Usage

```sh
$ ds
? What is your query:(type .help to get helps) 请介绍一下李白
李白（701年－762年），字太白，号青莲居士，唐朝时期伟大的浪漫主义诗人，被后人誉为“诗仙”，与杜甫并称为“李杜”。他是中国古代文学的杰出代表之一，其诗歌才情横溢、豪放洒脱、意境开阔，对后世影响深远。

李白出生于西域碎叶城（今吉尔吉斯斯坦托克马克附近），自幼好学，博览群书，尤其喜好道家和道教文化。他的诗作题材广泛，包括山水田园、边塞战争、历史咏史、饮酒送别、抒怀言志等，形式多样，既有长篇叙事诗，也有短小精悍的绝句。李白的诗歌语言生动活泼，善于运用夸张、比喻、象征等修辞手法，富有音乐性和画面感。

李白的一生充满传奇色彩，他游历过许多地方，结交了许多文人墨客，如王之涣、孟浩然等人，曾得到唐玄宗赏识，并赐金带。然而，由于个性张扬，不拘小节，又屡次因醉酒惹祸，最终在安史之乱期间流落江南，病逝于当涂县（今安徽马鞍山）采石矶。

李白的诗歌在中国文学史上占据了重要地位，作品流传甚广，深受读者喜爱，被誉为“诗中之仙”。他的诗歌艺术成就和人格魅力，使他在世界范围内也享有极高的声誉。
```

## License

The MIT license.
