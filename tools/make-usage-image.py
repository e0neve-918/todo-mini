"""소개 사이트용 사용 예시 이미지(투명 PNG)를 실제 앱 화면 코드로 그려요.
사용: python3 tools/make-usage-image.py <글꼴.otf/.ttf> <저장할.png>
- 글꼴은 사용자가 보내준 태백은하수체 파일. 크롬이 못 읽는 CFF 이름을 영어로 고친 사본을 자동으로 만들어요.
- 할 일: 택배 언박싱 / 식물 물 주기 / 산책 30분 / 숨쉬기(체크). 왼쪽=평소 모습, 오른쪽=편집 화면(간이 바 보임).
- 설정 값(색 171,173,177 → 86,117,184 / 강조 128,151,255 / 글자 흰색 / 굵게)은 아래 state()에 있어요. 앱 모양이 바뀌면 값도 맞춰요.
- 필요: playwright(chromium), fontTools
"""
import sys, os, base64, tempfile
from fontTools.ttLib import TTFont
FONT, OUT = sys.argv[1], os.path.abspath(sys.argv[2])
CORE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'core')
CORE = os.path.abspath(CORE)
_f = TTFont(FONT)
if 'CFF ' in _f: _f['CFF '].cff.fontNames = ['TaebaekMilkyway']
_tmp = os.path.join(tempfile.mkdtemp(), 'f.otf'); _f.save(_tmp)
B64 = os.path.join(os.path.dirname(_tmp), 'f.b64')
open(B64, 'w').write(base64.b64encode(open(_tmp, 'rb').read()).decode())
import asyncio, json
from playwright.async_api import async_playwright
def svg(s): 
    import urllib.parse
    return "data:image/svg+xml;utf8,"+urllib.parse.quote(s)
MOON=svg("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><path fill='#9DB4E0' stroke='white' stroke-width='7' stroke-linejoin='round' d='M40 10a29 29 0 1 0 30 40A23 23 0 0 1 40 10z'/></svg>")
STAR=svg("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'><path fill='#F6D56B' stroke='white' stroke-width='7' stroke-linejoin='round' d='M40 8l9 20 22 3-16 15 4 22-19-11-19 11 4-22L9 31l22-3z'/></svg>")
def state(mode):
    return {"todos":[
      {"id":"a","text":"숨쉬기","done":True},
      {"id":"b","text":"택배 언박싱","done":False},
      {"id":"c","text":"식물 물 주기","done":False},
      {"id":"d","text":"산책 30분","done":False}],
     "settings":{"font":"Taebaek","fsz":14,"fw":700,"tb":True,"opa":100,"lock":False,"boot":False,
                 "c1":[171,173,177],"c2":[86,117,184],"seed":7,"tmode":"fixed","tl":[255,255,255],"td":[31,41,51],"tf":[255,255,255],"acc":[128,151,255]},
     "library":[{"id":"l1","file":"x","url":MOON},{"id":"l2","file":"y","url":STAR}],
     "placed":[],
     "mode":mode,"version":"0.4.3"}
STUB="""
(function(){var st=document.createElement('style');st.textContent="@font-face{font-family:Taebaek;src:url(data:font/otf;base64,"+__B64__+")}.tx,.hd,.seg button,.add input,.hd span{-webkit-text-stroke:.85px currentColor}.add input::placeholder{-webkit-text-stroke:.85px currentColor}";document.addEventListener('DOMContentLoaded',function(){document.head.appendChild(st);});})();
(function(){var m=location.hash.indexOf('work')>0?'work':'desktop';var S=%s[m];
window.api={getState:()=>Promise.resolve(S),onState:()=>{},setTodos:()=>{},patch:()=>{},setPlaced:()=>{},ignore:()=>{},getPos:()=>Promise.resolve([0,0]),moveTo:()=>{},openSettings:()=>{},togglePeek:()=>{},addLibrary:()=>{},removeLibrary:()=>{},place:()=>{},fonts:()=>Promise.resolve([])};})();
""" % json.dumps({"desktop":state("desktop"),"work":state("work")})
HTML="""<!doctype html><html><head><meta charset=utf-8><style>
body{margin:0;width:816px;height:404px;overflow:hidden;font-family:'Noto Sans CJK KR','Noto Sans KR','Malgun Gothic',sans-serif;
background:transparent}
html{background:transparent}
.col{position:absolute;top:0;width:420px;text-align:center}
.col iframe{border:0;width:420px;height:360px;background:transparent;display:block}
.cap{position:absolute;top:410px;width:420px;text-align:center;color:#fff}
.cap b{display:block;font-size:17px;font-weight:700;letter-spacing:-.2px}
.cap span{display:block;margin-top:4px;font-size:13px;opacity:.78}
</style></head><body>
<div class=col style="left:20px;top:54px"><iframe src="renderer/index.html#work" scrolling=no></iframe></div>
<div class=col style="left:376px;top:16px"><iframe src="renderer/index.html#desktop" scrolling=no></iframe></div>
</body></html>"""
STUB=STUB.replace('__B64__','"'+open(B64).read()+'"')
open(CORE+'/hero_tmp.html','w').write(HTML)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={'width':816,'height':404},device_scale_factor=2,bypass_csp=True)
        await ctx.add_init_script(STUB)
        pg=await ctx.new_page()
        await pg.goto('file://'+CORE+'/hero_tmp.html'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=OUT,omit_background=True)
        await b.close()
asyncio.run(main())
