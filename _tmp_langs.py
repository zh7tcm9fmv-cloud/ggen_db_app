import re
text = open('templates/index.html', encoding='utf-8').read()
# T={EN:{...},TW:{...},...
m = re.match(r"const T=\{([^:]+):", text)
# find top-level keys in T=
start = text.find('const T={')
chunk = text[start:start+200000]
# naive: EN:, TW:
for lang in ['EN', 'TW', 'HK', 'JA', 'JP']:
    if re.search(r'\b' + lang + r'\s*:\s*\{', chunk):
        print('has', lang)
