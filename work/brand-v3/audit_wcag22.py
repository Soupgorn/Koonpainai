import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/home/stars/Documents/Codex/2026-10-21/files-pasted-by-the-user-master/outputs/brand-v3')
results=[]
paths=['/','/friends/bean','/my-timetable','/my-timetable/import','/account','/onboarding','/onboarding/policy','/pending-approval','/admin','/admin/access','/admin/import','/login','/not-a-page']
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for width in [375,1440]:
        page=browser.new_page(viewport={'width':width,'height':900},color_scheme='light',reduced_motion='reduce')
        for path in paths:
            page.goto('http://127.0.0.1:3100'+path,wait_until='networkidle');page.evaluate('document.fonts.ready')
            page.add_script_tag(path='/home/stars/Koonpainai/node_modules/axe-core/axe.min.js')
            violations=page.evaluate("async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))")
            results.append({'route':path,'width':width,'violations':violations})
            assert not violations,(path,width,violations)
        page.close()
    browser.close()
(out/'accessibility-results.json').write_text(json.dumps(results,indent=2))
print('Passed 26 whole-page Axe audits including WCAG 2.2 AA rules.')
