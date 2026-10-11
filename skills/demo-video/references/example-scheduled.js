// 通用示例剧本：浏览定时任务并打开创建弹窗，全程不提交表单。
// 示例页面需提供下列路由、标签和表单；请按目标页面替换选择器和文案。
window.__demo.arm(async ({ d, sleep, until, leaf, button, move, drift, press, zoomOut, caption }) => {
  await d.go({ to: [innerWidth * 0.5, innerHeight * 0.62], ms: 10 })
  await sleep(300)
  caption('Automate your routine updates')
  await sleep(600)

  const nav = [...document.querySelectorAll('a')].find((a) => (a.getAttribute('href') || '').endsWith('/demo/scheduled'))
  await move(nav, { zoom: 1.8, ms: 1300 })
  await press(nav)
  await until(() => leaf(document.body, /^Templates$/))
  await sleep(400)
  caption('')
  await zoomOut(1000)
  await sleep(300)

  caption('See each task and its schedule at a glance')
  const sched = leaf(document.body, /Every weekday at 09:00/)
  let card = sched
  while (card && card.getBoundingClientRect().height < 150) card = card.parentElement
  await move(sched, { zoom: 1.75, focus: card, ms: 1400, ax: 0.15 })
  await drift(leaf(card, /Agent: Demo Assistant/) || sched, card, { ax: 0.8, ms: 1600 })

  caption('Start from a ready-made template')
  const tpl = button(document, /Daily Summary/)
  await move(tpl, { zoom: 1.6, focus: tpl, ms: 1400, ax: 0.6, ay: 0.35 })
  await drift(tpl, tpl, { ax: 0.93, ms: 1050, push: 0.05 })
  await press(tpl)
  // 弹窗在放大状态下打开没问题（居中 fixed），出来后再拉远；下拉框 / Popover 不行，要先拉远再点开
  const dlg = await until(() => document.querySelector('[role="dialog"]'))
  await zoomOut(900)
  await sleep(400)

  caption('Name and instructions come pre-filled — tweak them freely')
  const name = dlg.querySelector('input')
  const instr = dlg.querySelector('textarea')
  await move(name, { zoom: 1.6, focus: name, ms: 1300, ax: 0.2 })
  await drift(name, name, { ax: 0.45, ms: 850, push: 0.03 })
  await move(instr, { zoom: 1.6, focus: instr, ms: 1100, ax: 0.15, ay: 0.3 })
  await drift(instr, instr, { ax: 0.8, ay: 0.45, ms: 1700 })

  caption('Choose which days and what time it runs')
  const rep = leaf(dlg, /^Every weekday$/)
  const time = leaf(dlg, /^08:30$/)
  await move(rep, { zoom: 1.7, focus: rep, ms: 1100 })
  await sleep(400)
  await move(time, { zoom: 1.7, focus: time, ms: 1000 })
  await drift(time, time, { ax: 0.7, ms: 850, push: 0.04 })

  caption('Your assistant runs the task on schedule')
  await zoomOut(800)
  const create = button(dlg, /^Create$/)
  await move(create, { zoom: 1.8, focus: create, ms: 1300 })
  await drift(create, create, { ax: 0.55, ms: 1200, push: 0.06 })
  caption('')
  await zoomOut(1000)
  await sleep(700)
}, 'scheduled-demo.webm')
