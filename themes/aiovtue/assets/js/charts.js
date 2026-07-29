
import { registerPageCleanup } from './page-cleanup.js'
import { preservePjaxHistoryState, parseJsonData } from './utils.js'
import { initLazyImages } from './lazy-images.js'
import { refreshMobileCardsListPage } from './home.js'

let echartsScriptPromise = null

function normalizeCategory(value) {
  return String(value || '').trim().toLowerCase()
}

function postMatchesCategory(rawCategories, categoryKey) {
  if (!categoryKey) return false
  if (categoryKey === 'Uncategorized') {
    return !rawCategories || (Array.isArray(rawCategories) && rawCategories.length === 0)
  }
  let cats = rawCategories
  if (typeof cats === 'string') {
    try { cats = JSON.parse(cats) } catch (_) { /* keep raw string */ }
  }
  if (!cats) return false
  if (typeof cats === 'string') return normalizeCategory(cats) === normalizeCategory(categoryKey)
  if (Array.isArray(cats)) {
    const key = normalizeCategory(categoryKey)
    if (!categoryKey.includes('/')) {
      return cats.some((item) => normalizeCategory(item) === key)
    }
    const joined = cats.map(normalizeCategory).join('/')
    const root = normalizeCategory(categoryKey.split('/')[0])
    return joined.startsWith(key) && normalizeCategory(cats[0]) === root
  }
  return false
}

function postMatchesTag(rawTags, tagKey) {
  if (!tagKey) return false
  let tags = rawTags
  if (typeof tags === 'string') {
    try { tags = JSON.parse(tags) } catch (_) { /* keep raw string */ }
  }
  if (!tags) return false
  if (typeof tags === 'string') return normalizeCategory(tags) === normalizeCategory(tagKey)
  if (Array.isArray(tags)) {
    const key = normalizeCategory(tagKey)
    return tags.some((item) => normalizeCategory(item) === key)
  }
  return false
}

function updateFilteredPostCards(postItems) {
  let visibleIndex = 0
  postItems.forEach((el) => {
    if (el.hidden) return
    const card = el.querySelector('.sakura-post-card')
    if (!card) return
    card.classList.remove('left', 'right')
    card.classList.add(visibleIndex % 2 === 0 ? 'right' : 'left')
    visibleIndex += 1
  })
}

function loadEchartsScript() {
  if (window.echarts?.init) return Promise.resolve(window.echarts)
  if (echartsScriptPromise) return echartsScriptPromise

  const chartEl = document.querySelector('[data-echarts-url]')
  const scriptUrl = chartEl?.dataset.echartsUrl
  if (!scriptUrl) return Promise.reject(new Error('echarts local url missing'))

  const resolvedScriptUrl = new URL(scriptUrl, window.location.href).href
  echartsScriptPromise = new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts).find((item) => item.src === resolvedScriptUrl)
    if (existing) {
      if (window.echarts?.init) {
        resolve(window.echarts)
        return
      }
      existing.addEventListener('load', () => resolve(window.echarts), { once: true })
      existing.addEventListener('error', () => reject(new Error('echarts load failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = scriptUrl
    script.defer = true
    script.onload = () => resolve(window.echarts)
    script.onerror = () => reject(new Error('echarts load failed'))
    document.body.appendChild(script)
  })

  return echartsScriptPromise
}

function initCategoriesPage(echartsLib, textColor, primary) {
  const catDataEl = document.getElementById('categories-chart-data')
  const chartEl = document.getElementById('categories-chart')
  const postSection = document.getElementById('categories-post-section')
  if (!catDataEl || !chartEl || !postSection) return

  const postItems = Array.from(document.querySelectorAll('.categories-post-item'))
  const tagButtons = Array.from(document.querySelectorAll('.sakura-categories-page .sakura-tag-button[data-category]'))
  let currentCategory = ''

  const updatePostCardsLayout = () => updateFilteredPostCards(postItems)

  const setCategory = (categoryKey) => {
    currentCategory = categoryKey || ''
    const url = new URL(window.location.href)
    if (currentCategory) url.searchParams.set('category', currentCategory)
    else url.searchParams.delete('category')
    preservePjaxHistoryState(url)

    tagButtons.forEach((btn) => {
      btn.classList.toggle('clicked', btn.dataset.category === currentCategory)
    })

    if (!currentCategory) {
      postSection.hidden = true
      postItems.forEach((el) => { el.hidden = true })
      return
    }

    postSection.hidden = false
    postItems.forEach((el) => {
      el.hidden = !postMatchesCategory(el.dataset.categories, currentCategory)
    })
    updatePostCardsLayout()
    initLazyImages(postSection)
    refreshMobileCardsListPage()
  }

  const selectCategory = (categoryKey) => {
    if (!categoryKey) return
    setCategory(categoryKey)
    postSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  try {
    const data = parseJsonData(catDataEl).map((item) => ({
      ...item,
      categoryKey: item.categoryKey || item.name,
    }))
    const chart = echartsLib.init(chartEl)
    chart.setOption({
      title: { text: '文章分类统计图', left: 'center', textStyle: { color: textColor } },
      tooltip: { trigger: 'item', formatter: '{b} : {c}篇 ({d}%)' },
      legend: {
        top: 'bottom',
        data: data.map((item) => item.name),
        textStyle: { color: textColor },
        selectedMode: true,
      },
      color: [primary, '#ff8787', '#ff6b6b', '#fab005', '#fcc419', '#8E71C1', '#6e5494', '#8cb1b3'],
      series: [{
        name: '文章篇数',
        type: 'pie',
        radius: [30, 80],
        center: ['50%', '45%'],
        roseType: 'area',
        data,
        label: { color: textColor, formatter: '{b} : {c} ({d}%)' },
        itemStyle: {
          emphasis: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(255, 255, 255, 0.5)',
          },
        },
      }],
    })
    chart.on('click', 'series', (event) => {
      const key = event.data?.categoryKey || event.data?.name
      if (key) selectCategory(String(key))
    })
    bindChartResize(chart)

    tagButtons.forEach((btn) => {
      btn.addEventListener('click', () => selectCategory(btn.dataset.category || ''))
    })

    const initial = new URLSearchParams(window.location.search).get('category')
    if (initial) setCategory(initial)
  } catch (err) {
    console.warn('[categories-chart]', err)
  }
}

function initTagsPage(echartsLib, textColor, primary) {
  const tagDataEl = document.getElementById('tags-chart-data')
  const chartEl = document.getElementById('tags-chart')
  const postSection = document.getElementById('tags-post-section')
  if (!tagDataEl || !chartEl || !postSection) return

  const postItems = Array.from(document.querySelectorAll('.tags-post-item'))
  const tagButtons = Array.from(document.querySelectorAll('.sakura-tags-page .sakura-tag-button[data-tag]'))
  let currentTag = ''
  let chartData = []

  const resolveTagKey = (input) => {
    if (!input) return ''
    const normInput = normalizeCategory(input)
    const btn = tagButtons.find((item) => normalizeCategory(item.dataset.tag) === normInput)
    if (btn) return btn.dataset.tag || ''
    const item = chartData.find((entry) =>
      normalizeCategory(entry.tagKey) === normInput || normalizeCategory(entry.name) === normInput,
    )
    return item?.tagKey || input
  }

  const setTag = (tagKey) => {
    currentTag = resolveTagKey(tagKey)
    const url = new URL(window.location.href)
    if (currentTag) url.searchParams.set('tag', currentTag)
    else url.searchParams.delete('tag')
    preservePjaxHistoryState(url)

    tagButtons.forEach((btn) => {
      btn.classList.toggle('clicked', normalizeCategory(btn.dataset.tag) === normalizeCategory(currentTag))
    })

    if (!currentTag) {
      postSection.hidden = true
      postItems.forEach((el) => { el.hidden = true })
      return
    }

    postSection.hidden = false
    postItems.forEach((el) => {
      el.hidden = !postMatchesTag(el.dataset.tags, currentTag)
    })
    updateFilteredPostCards(postItems)
    initLazyImages(postSection)
    refreshMobileCardsListPage()
  }

  const selectTag = (tagKey) => {
    if (!tagKey) return
    setTag(tagKey)
    postSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  try {
    chartData = parseJsonData(tagDataEl).map((item) => ({
      ...item,
      tagKey: item.tagKey || item.name,
    }))
    const chart = echartsLib.init(chartEl)
    chart.setOption({
      title: {
        text: chartData.length ? `Top ${chartData.length} 标签统计图` : '标签统计图',
        left: 'center',
        textStyle: { color: textColor },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: chartData.length > 6 ? '20%' : '14%',
        top: '16%',
        containLabel: true,
      },
      tooltip: { formatter: '{b}<br/>文章篇数: {c}' },
      xAxis: {
        name: '标签',
        type: 'category',
        data: chartData.map((item) => item.name),
        axisLabel: { color: textColor, interval: 0 },
        axisLine: { lineStyle: { color: textColor } },
      },
      yAxis: {
        name: '文章篇数',
        type: 'value',
        splitLine: { show: false },
        axisLabel: { color: textColor },
        axisLine: { lineStyle: { color: textColor } },
      },
      series: [{
        name: '文章篇数',
        type: 'bar',
        data: chartData,
        itemStyle: { color: primary },
        emphasis: { itemStyle: { color: primary } },
      }],
    })
    chart.on('click', 'series', (event) => {
      const item = chartData[event.dataIndex]
      const key = item?.tagKey || (typeof event.data === 'object' && event.data?.tagKey) || event.name
      if (key) selectTag(String(key))
    })
    bindChartResize(chart)

    tagButtons.forEach((btn) => {
      btn.addEventListener('click', () => selectTag(btn.dataset.tag || ''))
    })

    const initial = new URLSearchParams(window.location.search).get('tag')
    if (initial) setTag(initial)
  } catch (err) {
    console.warn('[tags-chart]', err)
  }
}

function bindChartResize(chart) {
  const onResize = () => chart.resize()
  window.addEventListener('resize', onResize)
  registerPageCleanup(() => window.removeEventListener('resize', onResize))
}

export async function initCharts() {
  const hasChart = document.getElementById('archives-chart')
    || document.getElementById('categories-chart')
    || document.getElementById('tags-chart')
  if (!hasChart) return

  let echartsLib
  try {
    echartsLib = await loadEchartsScript()
  } catch (err) {
    console.warn('[charts]', err)
    return
  }
  if (!echartsLib?.init) return

  const textColor = document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,.7)' : '#4c4948'
  const primary = getComputedStyle(document.documentElement).getPropertyValue('--sakura-color-primary').trim() || '#DF9193'

  initCategoriesPage(echartsLib, textColor, primary)
  initTagsPage(echartsLib, textColor, primary)

  const archivesEl = document.getElementById('archives-chart')
  const archivesData = document.getElementById('archives-posts-data')
  if (archivesEl && archivesData) {
    try {
      const posts = parseJsonData(archivesData)
      const start = archivesEl.dataset.start || '2024-01'
      const months = []
      const counts = {}
      const [sy, sm] = start.split('-').map(Number)
      const now = new Date()
      let y = sy; let m = sm
      while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
        const key = `${y}-${String(m).padStart(2, '0')}`
        months.push(key)
        counts[key] = 0
        m++; if (m > 12) { m = 1; y++ }
      }
      posts.forEach((p) => {
        const key = String(p.date || '').replace(/^"+|"+$/g, '').slice(0, 7)
        if (counts[key] !== undefined) counts[key]++
      })
      const chart = echartsLib.init(archivesEl)
      chart.setOption({
        title: { text: '文章发布统计图', left: 'center', textStyle: { color: textColor } },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: months, axisLabel: { color: textColor } },
        yAxis: { type: 'value', axisLabel: { color: textColor } },
        series: [{
          type: 'line', smooth: true, data: months.map(k => counts[k]),
          areaStyle: { color: 'rgba(223, 145, 147, 0.25)' },
          itemStyle: { color: primary },
          lineStyle: { color: primary },
        }],
      })
      bindChartResize(chart)
    } catch (err) { console.warn('[archives-chart]', err) }
  }
}

export function cleanupCharts() {
  if (window.echarts) {
    ['archives-chart', 'categories-chart', 'tags-chart'].forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return
      const chart = window.echarts.getInstanceByDom(el)
      if (chart) chart.dispose()
    })
  }
}
