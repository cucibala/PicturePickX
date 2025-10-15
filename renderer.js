// 应用状态
const appState = {
  sourceFolder: null,
  targetFolder: null,
  images: [],
  selectedImages: new Set(),
  mode: 'copy', // 'copy' 或 'move'
  zoomLevel: 100
};

// DOM 元素
const elements = {
  selectSourceBtn: document.getElementById('selectSourceBtn'),
  selectTargetBtn: document.getElementById('selectTargetBtn'),
  sourcePath: document.getElementById('sourcePath'),
  targetPath: document.getElementById('targetPath'),
  zoomSlider: document.getElementById('zoomSlider'),
  zoomValue: document.getElementById('zoomValue'),
  imageGrid: document.getElementById('imageGrid'),
  selectAllBtn: document.getElementById('selectAllBtn'),
  deselectAllBtn: document.getElementById('deselectAllBtn'),
  executeBtn: document.getElementById('executeBtn'),
  executeBtnText: document.getElementById('executeBtnText'),
  totalCount: document.getElementById('totalCount'),
  selectedCount: document.getElementById('selectedCount'),
  unselectedCount: document.getElementById('unselectedCount'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  modeRadios: document.querySelectorAll('input[name="mode"]')
};

// 初始化事件监听器
function initEventListeners() {
  // 选择源文件夹
  elements.selectSourceBtn.addEventListener('click', async () => {
    const folder = await window.electronAPI.selectFolder('选择源图片文件夹');
    if (folder) {
      appState.sourceFolder = folder;
      elements.sourcePath.textContent = folder;
      elements.sourcePath.classList.add('active');
      await loadImages();
    }
  });
  
  // 选择目标文件夹
  elements.selectTargetBtn.addEventListener('click', async () => {
    const folder = await window.electronAPI.selectFolder('选择目标文件夹');
    if (folder) {
      appState.targetFolder = folder;
      elements.targetPath.textContent = folder;
      elements.targetPath.classList.add('active');
      updateExecuteButton();
    }
  });
  
  // 缩放控制
  elements.zoomSlider.addEventListener('input', (e) => {
    appState.zoomLevel = parseInt(e.target.value);
    elements.zoomValue.textContent = `${appState.zoomLevel}%`;
    updateImageZoom();
  });
  
  // 模式切换
  elements.modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      appState.mode = e.target.value;
      updateExecuteButton();
    });
  });
  
  // 全选
  elements.selectAllBtn.addEventListener('click', () => {
    appState.images.forEach(img => {
      appState.selectedImages.add(img);
    });
    updateImageSelection();
    updateStats();
  });
  
  // 取消全选
  elements.deselectAllBtn.addEventListener('click', () => {
    appState.selectedImages.clear();
    updateImageSelection();
    updateStats();
  });
  
  // 执行操作
  elements.executeBtn.addEventListener('click', async () => {
    await executeOperation();
  });
}

// 加载图片
async function loadImages() {
  if (!appState.sourceFolder) return;
  
  showLoading(true);
  
  try {
    const images = await window.electronAPI.getImages(appState.sourceFolder);
    appState.images = images;
    appState.selectedImages.clear();
    
    renderImages();
    updateStats();
    updateExecuteButton();
  } catch (error) {
    console.error('加载图片失败:', error);
    await window.electronAPI.showMessage('error', '错误', '加载图片失败: ' + error.message);
  } finally {
    showLoading(false);
  }
}

// 渲染图片
function renderImages() {
  const grid = elements.imageGrid;
  
  if (appState.images.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>该文件夹中没有找到图片</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = '';
  
  appState.images.forEach((imagePath, index) => {
    const imageItem = createImageItem(imagePath, index);
    grid.appendChild(imageItem);
  });
}

// 创建图片项
function createImageItem(imagePath, index) {
  const item = document.createElement('div');
  item.className = 'image-item';
  item.dataset.path = imagePath;
  item.dataset.index = index;
  
  // 图片容器
  const imgContainer = document.createElement('div');
  imgContainer.className = 'image-container';
  
  // 图片元素
  const img = document.createElement('img');
  img.src = imagePath;
  img.alt = `Image ${index + 1}`;
  img.loading = 'lazy';
  
  // 选中指示器
  const indicator = document.createElement('div');
  indicator.className = 'selection-indicator';
  indicator.innerHTML = '✓';
  
  // 图片信息
  const info = document.createElement('div');
  info.className = 'image-info';
  const fileName = imagePath.split('\\').pop().split('/').pop();
  info.textContent = fileName;
  
  imgContainer.appendChild(img);
  imgContainer.appendChild(indicator);
  item.appendChild(imgContainer);
  item.appendChild(info);
  
  // 点击选择/取消选择
  item.addEventListener('click', () => {
    toggleImageSelection(imagePath, item);
  });
  
  return item;
}

// 切换图片选择状态
function toggleImageSelection(imagePath, itemElement) {
  if (appState.selectedImages.has(imagePath)) {
    appState.selectedImages.delete(imagePath);
    itemElement.classList.remove('selected');
  } else {
    appState.selectedImages.add(imagePath);
    itemElement.classList.add('selected');
  }
  
  updateStats();
}

// 更新所有图片的选择状态显示
function updateImageSelection() {
  const items = elements.imageGrid.querySelectorAll('.image-item');
  items.forEach(item => {
    const path = item.dataset.path;
    if (appState.selectedImages.has(path)) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

// 更新图片缩放
function updateImageZoom() {
  const scale = appState.zoomLevel / 100;
  const baseSize = 200; // 基础大小
  const size = baseSize * scale;
  
  elements.imageGrid.style.setProperty('--image-size', `${size}px`);
}

// 更新统计信息
function updateStats() {
  const total = appState.images.length;
  const selected = appState.selectedImages.size;
  const unselected = total - selected;
  
  elements.totalCount.textContent = total;
  elements.selectedCount.textContent = selected;
  elements.unselectedCount.textContent = unselected;
  
  updateExecuteButton();
}

// 更新执行按钮状态
function updateExecuteButton() {
  const hasTarget = appState.targetFolder !== null;
  const hasSelection = appState.selectedImages.size > 0;
  
  elements.executeBtn.disabled = !hasTarget || !hasSelection;
  
  const modeText = appState.mode === 'copy' ? '复制' : '移动';
  elements.executeBtnText.textContent = `${modeText}选中图片到目标文件夹`;
}

// 执行操作（复制或移动）
async function executeOperation() {
  if (!appState.targetFolder || appState.selectedImages.size === 0) {
    return;
  }
  
  const selectedPaths = Array.from(appState.selectedImages);
  const modeText = appState.mode === 'copy' ? '复制' : '移动';
  
  showLoading(true);
  
  try {
    let result;
    if (appState.mode === 'copy') {
      result = await window.electronAPI.copyImages(selectedPaths, appState.targetFolder);
    } else {
      result = await window.electronAPI.moveImages(selectedPaths, appState.targetFolder);
    }
    
    if (result.success) {
      await window.electronAPI.showMessage(
        'info',
        '操作成功',
        `成功${modeText}了 ${result.results.length} 张图片`
      );
      
      // 如果是移动模式，需要重新加载图片列表
      if (appState.mode === 'move') {
        // 从列表中移除已移动的图片
        const movedPaths = new Set(result.results.map(r => r.source));
        appState.images = appState.images.filter(img => !movedPaths.has(img));
        appState.selectedImages.clear();
        renderImages();
        updateStats();
      } else {
        // 复制模式，只需清除选择
        appState.selectedImages.clear();
        updateImageSelection();
        updateStats();
      }
    } else {
      await window.electronAPI.showMessage(
        'error',
        '操作失败',
        `${modeText}图片时发生错误: ${result.error}`
      );
    }
  } catch (error) {
    console.error('操作失败:', error);
    await window.electronAPI.showMessage(
      'error',
      '错误',
      `${modeText}图片时发生错误: ${error.message}`
    );
  } finally {
    showLoading(false);
  }
}

// 显示/隐藏加载提示
function showLoading(show) {
  if (show) {
    elements.loadingOverlay.classList.remove('hidden');
  } else {
    elements.loadingOverlay.classList.add('hidden');
  }
}

// 初始化应用
function init() {
  initEventListeners();
  updateImageZoom();
}

// 当页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

