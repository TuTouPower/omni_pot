# DeepL 长文本返回原文

## 状态

已修复。

## 原问题

`1.txt` 中的多段英文客服申诉邮件输入翻译窗口时，DeepL 卡片返回的翻译结果与源文本完全一致；同样输入下 Bing 可正常翻译，较短英文段落 DeepL 也正常。

## 根因

DeepL 免费 JSON-RPC 分支把整篇多段文本作为一个 `jobs[0].sentences[0].text` 发送。实测该接口在长文本单 job 请求下会返回原文或截断英文；触发条件更接近单 job 文本过长，而不是多段或换行本身。

## 修复

- `deeplx_free` 分支改用参考项目 `pot-desktop` 的 `LMT_handle_texts` JSON-RPC 路径。
- 请求设置 `splitting: 'newlines'`，让 DeepL 服务端自行切分文本，并读取 `result.texts[0].text`。
- 增加 `tests/user_e2e/specs/external_services.spec.ts` opt-in 真实 DeepL 请求回归测试，验证多段长文本和长单段文本不再返回原文。
