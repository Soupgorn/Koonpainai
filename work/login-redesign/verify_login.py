from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect

out = Path('/home/stars/Documents/Codex/2026-10-21/files-pasted-by-the-user-master/outputs/login-redesign')
report = {'axe': [], 'viewports': [], 'page_errors': [], 'external_requests': []}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for scheme in ('light', 'dark'):
        context = browser.new_context(color_scheme=scheme, reduced_motion='reduce')
        page = context.new_page()
        page.on('pageerror', lambda error: report['page_errors'].append(str(error)))
        page.on('request', lambda request: report['external_requests'].append(request.url) if request.url.startswith('http') and not request.url.startswith('http://localhost:3000/') else None)
        for width, height in ((320, 900), (375, 812), (430, 900), (768, 900), (1024, 900), (1440, 1000), (1920, 1080)):
            page.set_viewport_size({'width': width, 'height': height})
            page.goto('http://localhost:3000/login?signedOut=local', wait_until='networkidle')
            page.evaluate('document.fonts.ready')
            card = page.locator('.auth-card')
            button = page.get_by_role('button', name='Continue with KMITL SSO')
            expect(button).to_be_enabled()
            expect(page.locator('header, footer, nav')).to_have_count(0)
            box = card.bounding_box()
            assert abs(box['x'] + box['width']/2 - width/2) < 2
            assert abs(box['y'] + box['height']/2 - height/2) < 2
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            colors = button.evaluate('(e) => ({background:getComputedStyle(e).backgroundColor, color:getComputedStyle(e).color})')
            assert colors['background'] == 'rgb(50, 109, 181)'
            button.focus()
            expect(button).to_be_focused()
            assert button.evaluate('(e) => getComputedStyle(e).outlineStyle') == 'solid'
            assert button.evaluate('(e) => getComputedStyle(e).transitionDuration') == '0s'
            assert button.bounding_box()['height'] >= 46
            if width in (375, 1440):
                page.add_script_tag(path='/home/stars/Koonpainai/node_modules/axe-core/axe.min.js')
                violations = page.evaluate("async () => (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v => ({id:v.id,targets:v.nodes.map(n=>n.target)}))")
                assert not violations, violations
                report['axe'].append({'width': width, 'scheme': scheme, 'violations': 0})
                button.evaluate('(e) => e.blur()')
                page.screenshot(path=str(out / f'after-{width}-{scheme}.png'), full_page=True, animations='disabled')
            report['viewports'].append({'width': width, 'height': height, 'scheme': scheme, 'card': box, 'button': colors})
        response = context.request.get('http://localhost:3000/api/auth/providers')
        assert response.ok
        provider = response.json()['keycloak']
        assert provider['signinUrl'].endswith('/api/auth/signin/keycloak')
        assert provider['callbackUrl'].endswith('/api/auth/callback/keycloak')
        context.close()

    # Verify keyboard submission and the enabled pending state without sending the POST upstream.
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
    page = context.new_page()
    page.goto('http://localhost:3000/login', wait_until='networkidle')
    held = []
    page.route('**/login', lambda route: held.append(route) if route.request.method == 'POST' else route.continue_())
    button = page.get_by_role('button', name='Continue with KMITL SSO')
    button.focus()
    page.keyboard.press('Enter')
    pending = page.get_by_role('button', name='Connecting to KMITL…')
    expect(pending).to_be_disabled()
    expect(pending).to_have_attribute('aria-busy', 'true')
    assert len(held) == 1
    page.screenshot(path=str(out / 'pending-desktop.png'), full_page=True, animations='disabled')
    context.close()  # Cancels the held request; no university authentication is attempted.

    context = browser.new_context(viewport={'width': 375, 'height': 812}, reduced_motion='reduce')
    page = context.new_page()
    page.set_viewport_size({'width': 320, 'height': 360})
    page.goto('http://localhost:3000/login', wait_until='networkidle')
    assert page.locator('.auth-card').bounding_box()['y'] >= 0
    page.get_by_role('button').scroll_into_view_if_needed()
    expect(page.get_by_role('button')).to_be_in_viewport()
    context.close()
    browser.close()
assert not report['page_errors'], report['page_errors']
assert not report['external_requests'], report['external_requests']
(out / 'browser-results.json').write_text(json.dumps(report, indent=2))
print(f"Passed {len(report['viewports'])} enabled-state viewport/theme checks, keyboard/pending checks and provider routing. No external requests or unexpected page errors.")
