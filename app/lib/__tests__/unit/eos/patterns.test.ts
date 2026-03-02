import { describe, it, expect } from 'vitest';
import { detectMemoryLeaks, detectEventListenerLeaks } from '@/lib/eos/patterns';

describe('detectMemoryLeaks', () => {
  it('flags setInterval with no clearInterval', () => {
    const content = `
      function start() {
        setInterval(() => doWork(), 1000);
      }
    `;
    const issues = detectMemoryLeaks(content, 'timer.ts');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.type).toBe('MEMORY_LEAK');
    expect(issues[0]?.severity).toBe('DANGER');
  });

  it('does not flag setInterval when clearInterval is present', () => {
    const content = `
      let id: NodeJS.Timeout;
      function start() { id = setInterval(() => doWork(), 1000); }
      function stop()  { clearInterval(id); }
    `;
    expect(detectMemoryLeaks(content, 'timer.ts')).toHaveLength(0);
  });

  it('does not flag commented-out setInterval', () => {
    const content = `
      // setInterval(() => {}, 100);
      function noop() {}
    `;
    expect(detectMemoryLeaks(content, 'timer.ts')).toHaveLength(0);
  });

  it('reports correct line number', () => {
    const content = 'function a() {}\nsetInterval(() => {}, 500);\nfunction b() {}';
    const issues = detectMemoryLeaks(content, 'timer.ts');
    expect(issues[0]?.line).toBe(2);
  });

  it('flags multiple setInterval calls in same file', () => {
    const content = [
      'setInterval(a, 100);',
      'setInterval(b, 200);',
      'setInterval(c, 300);',
    ].join('\n');
    const issues = detectMemoryLeaks(content, 'timer.ts');
    expect(issues).toHaveLength(3);
  });
});

describe('detectEventListenerLeaks', () => {
  it('flags addEventListener with no removeEventListener', () => {
    const content = `
      class Foo {
        init() { window.addEventListener('resize', this.onResize); }
      }
    `;
    const issues = detectEventListenerLeaks(content, 'foo.ts');
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.type).toBe('EVENT_LISTENER_LEAK');
    expect(issues[0]?.severity).toBe('WARNING');
  });

  it('does not flag when removeEventListener is present', () => {
    const content = `
      class Foo {
        init()    { window.addEventListener('resize', this.onResize); }
        destroy() { window.removeEventListener('resize', this.onResize); }
      }
    `;
    expect(detectEventListenerLeaks(content, 'foo.ts')).toHaveLength(0);
  });

  it('includes event name in message', () => {
    const content = "el.addEventListener('click', handler);";
    const issues = detectEventListenerLeaks(content, 'foo.ts');
    expect(issues[0]?.message).toContain('click');
  });

  it('caps at 5 issues per file', () => {
    const lines = Array.from(
      { length: 10 },
      (_, i) => `el.addEventListener('event${i}', h);`,
    ).join('\n');
    const issues = detectEventListenerLeaks(lines, 'foo.ts');
    expect(issues.length).toBeLessThanOrEqual(5);
  });

  it('skips commented-out addEventListener lines', () => {
    const content = "// el.addEventListener('click', handler);";
    expect(detectEventListenerLeaks(content, 'foo.ts')).toHaveLength(0);
  });
});
