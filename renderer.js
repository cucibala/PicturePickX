// 应用状态
const appState = {
  sourceFolder: null,
  targetFolder: null,
  images: [], // 所有图片路径
  displayedImages: [], // 当前显示的图片
  selectedImages: new Set(),
  mode: 'copy', // 'copy' 或 'move'
  zoomLevel: 100,
  currentPage: 0,
  pageSize: 100, // 每页显示100张图片
  isLoading: false
};

// 状态保存和恢复
const STATE_STORAGE_KEY = 'picturePickX_state';

function saveState() {
  const state = {
    sourceFolder: appState.sourceFolder,
    targetFolder: appState.targetFolder,
    mode: appState.mode,
    zoomLevel: appState.zoomLevel,
    pageSize: appState.pageSize
  };
  localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STATE_STORAGE_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      
      // 恢复文件夹路径
      if (state.sourceFolder) {
        appState.sourceFolder = state.sourceFolder;
        elements.sourcePath.textContent = state.sourceFolder;
        elements.sourcePath.classList.add('active');
      }
      
      if (state.targetFolder) {
        appState.targetFolder = state.targetFolder;
        elements.targetPath.textContent = state.targetFolder;
        elements.targetPath.classList.add('active');
      }
      
      // 恢复模式
      if (state.mode) {
        appState.mode = state.mode;
        const modeRadio = document.querySelector(`input[name="mode"][value="${state.mode}"]`);
        if (modeRadio) {
          modeRadio.checked = true;
        }
      }
      
      // 恢复缩放级别
      if (state.zoomLevel) {
        appState.zoomLevel = state.zoomLevel;
        elements.zoomSlider.value = state.zoomLevel;
        elements.zoomValue.textContent = `${state.zoomLevel}%`;
        updateImageZoom();
      }
      
      // 恢复每页数量
      if (state.pageSize) {
        appState.pageSize = state.pageSize;
        elements.pageSizeSelect.value = state.pageSize;
      }
      
      // 如果有源文件夹，自动加载图片
      if (state.sourceFolder) {
        // 延迟加载，确保界面已完全初始化
        setTimeout(() => {
          loadImages().catch(error => {
            console.error('自动加载图片失败:', error);
            // 如果加载失败，清除源文件夹状态
            appState.sourceFolder = null;
            elements.sourcePath.textContent = '未选择';
            elements.sourcePath.classList.remove('active');
          });
        }, 100);
      }
      
      updateExecuteButton();
    }
  } catch (error) {
    console.error('加载保存的状态失败:', error);
  }
}

// DOM 元素
const elements = {
  selectSourceBtn: document.getElementById('selectSourceBtn'),
  selectTargetBtn: document.getElementById('selectTargetBtn'),
  sourcePath: document.getElementById('sourcePath'),
  targetPath: document.getElementById('targetPath'),
  zoomSlider: document.getElementById('zoomSlider'),
  zoomValue: document.getElementById('zoomValue'),
  pageSizeSelect: document.getElementById('pageSizeSelect'),
  imageGrid: document.getElementById('imageGrid'),
  mainContent: document.querySelector('.main-content'),
  selectAllBtn: document.getElementById('selectAllBtn'),
  deselectAllBtn: document.getElementById('deselectAllBtn'),
  executeBtn: document.getElementById('executeBtn'),
  executeBtnText: document.getElementById('executeBtnText'),
  totalCount: document.getElementById('totalCount'),
  selectedCount: document.getElementById('selectedCount'),
  unselectedCount: document.getElementById('unselectedCount'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  modeRadios: document.querySelectorAll('input[name="mode"]'),
  // 图片查看器
  imageViewer: document.getElementById('imageViewer'),
  viewerImage: document.getElementById('viewerImage'),
  viewerFilename: document.getElementById('viewerFilename'),
  viewerIndex: document.getElementById('viewerIndex'),
  viewerSize: document.getElementById('viewerSize'),
  viewerDimensions: document.getElementById('viewerDimensions'),
  viewerSelectIcon: document.getElementById('viewerSelectIcon')
};

// 图片查看器状态
const viewerState = {
  currentIndex: -1,
  currentPath: null,
  scale: 1,
  minScale: 0.5,
  maxScale: 3
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
      saveState(); // 保存状态
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
      saveState(); // 保存状态
      updateExecuteButton();
    }
  });
  
  // 缩放控制
  elements.zoomSlider.addEventListener('input', (e) => {
    appState.zoomLevel = parseInt(e.target.value);
    elements.zoomValue.textContent = `${appState.zoomLevel}%`;
    updateImageZoom();
    saveState(); // 保存状态
  });
  
  // 每页加载数量
  elements.pageSizeSelect.addEventListener('change', (e) => {
    appState.pageSize = parseInt(e.target.value);
    saveState(); // 保存状态
  });
  
  // 模式切换
  elements.modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      appState.mode = e.target.value;
      updateExecuteButton();
      saveState(); // 保存状态
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
  
  // 滚动加载更多 - 监听实际的滚动容器
  elements.mainContent.addEventListener('scroll', () => {
    handleScroll();
  });
}

// 加载图片
async function loadImages() {
  if (!appState.sourceFolder) return;
  
  showLoading(true);
  
  try {
    const images = await window.electronAPI.getImages(appState.sourceFolder);
    appState.images = images;
    appState.displayedImages = [];
    appState.selectedImages.clear();
    appState.currentPage = 0;
    
    // 初始加载第一页
    loadMoreImages();
    updateStats();
    updateExecuteButton();
  } catch (error) {
    console.error('加载图片失败:', error);
    await window.electronAPI.showMessage('error', '错误', '加载图片失败: ' + error.message);
  } finally {
    showLoading(false);
  }
}

// 加载更多图片（分页）
function loadMoreImages() {
  if (appState.isLoading) return;
  
  const start = appState.currentPage * appState.pageSize;
  const end = start + appState.pageSize;
  const newImages = appState.images.slice(start, end);
  
  if (newImages.length === 0) return;
  
  appState.isLoading = true;
  
  // 添加到已显示的图片列表
  appState.displayedImages.push(...newImages);
  appState.currentPage++;
  
  // 渲染新加载的图片
  renderNewImages(newImages, start);
  
  appState.isLoading = false;
}

// 处理滚动事件
function handleScroll() {
  const container = elements.mainContent;
  const scrollTop = container.scrollTop;
  const scrollHeight = container.scrollHeight;
  const clientHeight = container.clientHeight;
  
  // 当滚动到底部附近时加载更多
  if (scrollHeight - scrollTop - clientHeight < 500) {
    loadMoreImages();
  }
}

// 渲染图片（清空并重新渲染所有已显示的图片）
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
  
  // 清空并重新初始化
  appState.displayedImages = [];
  appState.currentPage = 0;
  
  // 加载第一页
  loadMoreImages();
}

// 渲染新加载的图片（追加模式）
function renderNewImages(images, startIndex) {
  const grid = elements.imageGrid;
  
  // 如果网格是空的（第一次加载），清除空状态
  const emptyState = grid.querySelector('.empty-state');
  if (emptyState) {
    grid.innerHTML = '';
  }
  
  images.forEach((imagePath, relativeIndex) => {
    const absoluteIndex = startIndex + relativeIndex;
    const imageItem = createImageItem(imagePath, absoluteIndex);
    grid.appendChild(imageItem);
  });
  
  // 显示加载进度
  updateLoadingProgress();
}

// 更新加载进度提示
function updateLoadingProgress() {
  const grid = elements.imageGrid;
  let progressDiv = grid.querySelector('.loading-progress');
  
  if (!progressDiv) {
    progressDiv = document.createElement('div');
    progressDiv.className = 'loading-progress';
    grid.appendChild(progressDiv);
  }
  
  const loaded = appState.displayedImages.length;
  const total = appState.images.length;
  
  if (loaded < total) {
    progressDiv.textContent = `已加载 ${loaded} / ${total} 张图片，向下滚动加载更多...`;
    progressDiv.style.display = 'block';
  } else {
    progressDiv.textContent = `全部 ${total} 张图片已加载完成`;
    progressDiv.style.display = 'block';
    // 3秒后隐藏
    setTimeout(() => {
      progressDiv.style.display = 'none';
    }, 3000);
  }
}

// Intersection Observer 用于懒加载
let imageObserver = null;

function initImageObserver() {
  if (imageObserver) return;
  
  const options = {
    root: elements.mainContent, // 使用实际的滚动容器
    rootMargin: '200px', // 提前200px开始加载
    threshold: 0.01
  };
  
  imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;
        
        if (src && !img.src) {
          img.src = src;
          img.removeAttribute('data-src');
          
          // 加载完成后停止观察
          imageObserver.unobserve(img);
        }
      }
    });
  }, options);
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
  
  // 图片元素 - 使用懒加载
  const img = document.createElement('img');
  img.dataset.src = imagePath; // 先存储在data-src中
  img.alt = `Image ${index + 1}`;
  img.className = 'lazy-image';
  
  // 添加占位背景
  const placeholder = document.createElement('div');
  placeholder.className = 'image-placeholder';
  placeholder.innerHTML = '🖼️';
  
  // 选中指示器
  const indicator = document.createElement('div');
  indicator.className = 'selection-indicator';
  indicator.innerHTML = '✓';
  
  // 图片信息
  const info = document.createElement('div');
  info.className = 'image-info';
  const fileName = imagePath.split('\\').pop().split('/').pop();
  info.textContent = fileName;
  
  imgContainer.appendChild(placeholder);
  imgContainer.appendChild(img);
  imgContainer.appendChild(indicator);
  item.appendChild(imgContainer);
  item.appendChild(info);
  
  // 点击选择/取消选择
  item.addEventListener('click', () => {
    toggleImageSelection(imagePath, item);
  });
  
  // 右键直接查看大图
  item.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openImageViewer(imagePath, index);
  });
  
  // 图片加载完成后隐藏占位符
  img.addEventListener('load', () => {
    img.classList.add('loaded');
    placeholder.style.display = 'none';
  });
  
  // 使用 Intersection Observer 进行懒加载
  if (imageObserver) {
    imageObserver.observe(img);
  }
  
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
    
    // 统计成功和失败的文件
    const successCount = result.results.filter(r => r.success).length;
    const failedCount = result.results.filter(r => !r.success).length;
    
    if (result.success) {
      // 全部成功
      await window.electronAPI.showMessage(
        'info',
        '操作成功',
        `成功${modeText}了 ${successCount} 张图片`
      );
      
      // 如果是移动模式，需要重新加载图片列表
      if (appState.mode === 'move') {
        // 从列表中移除已移动的图片
        const movedPaths = new Set(
          result.results.filter(r => r.success).map(r => r.source)
        );
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
    } else if (successCount > 0) {
      // 部分成功
      await window.electronAPI.showMessage(
        'warning',
        '部分成功',
        `成功${modeText}了 ${successCount} 张图片，${failedCount} 张失败\n\n失败原因: ${result.error}`
      );
      
      // 即使部分失败，也要更新界面
      if (appState.mode === 'move') {
        const movedPaths = new Set(
          result.results.filter(r => r.success).map(r => r.source)
        );
        appState.images = appState.images.filter(img => !movedPaths.has(img));
        
        // 只保留失败的图片的选择状态
        const failedPaths = new Set(
          result.results.filter(r => !r.success).map(r => r.source)
        );
        appState.selectedImages = new Set(
          Array.from(appState.selectedImages).filter(path => failedPaths.has(path))
        );
        
        renderImages();
        updateStats();
      } else {
        // 复制模式，清除成功的选择
        const successPaths = new Set(
          result.results.filter(r => r.success).map(r => r.source)
        );
        appState.selectedImages = new Set(
          Array.from(appState.selectedImages).filter(path => !successPaths.has(path))
        );
        updateImageSelection();
        updateStats();
      }
    } else {
      // 全部失败
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

// 图片查看器功能
function openImageViewer(imagePath, index) {
  viewerState.currentPath = imagePath;
  viewerState.currentIndex = appState.images.indexOf(imagePath);
  viewerState.scale = 1;
  
  // 显示查看器
  elements.imageViewer.classList.remove('hidden');
  
  // 加载图片
  loadViewerImage(imagePath);
  
  // 阻止body滚动
  document.body.style.overflow = 'hidden';
}

async function loadViewerImage(imagePath) {
  const fileName = imagePath.split('\\').pop().split('/').pop();
  const imageIndex = appState.images.indexOf(imagePath);
  
  // 更新文件名和索引
  elements.viewerFilename.textContent = fileName;
  elements.viewerIndex.textContent = `${imageIndex + 1} / ${appState.images.length}`;
  
  // 加载图片
  elements.viewerImage.src = imagePath;
  elements.viewerImage.style.transform = `scale(${viewerState.scale})`;
  
  // 更新选中状态图标
  updateViewerSelectIcon();
  
  // 获取并显示图片信息
  try {
    const info = await window.electronAPI.getImageInfo(imagePath);
    elements.viewerSize.textContent = info.sizeFormatted;
    
    // 等待图片加载完成获取尺寸
    elements.viewerImage.onload = () => {
      const width = elements.viewerImage.naturalWidth;
      const height = elements.viewerImage.naturalHeight;
      elements.viewerDimensions.textContent = `${width} × ${height}`;
    };
  } catch (error) {
    console.error('获取图片信息失败:', error);
    elements.viewerSize.textContent = '未知';
    elements.viewerDimensions.textContent = '未知';
  }
  
  viewerState.currentPath = imagePath;
}

function closeImageViewer() {
  elements.imageViewer.classList.add('hidden');
  viewerState.currentPath = null;
  viewerState.currentIndex = -1;
  viewerState.scale = 1;
  document.body.style.overflow = '';
}

function viewNextImage() {
  if (viewerState.currentIndex < appState.images.length - 1) {
    viewerState.currentIndex++;
    loadViewerImage(appState.images[viewerState.currentIndex]);
  }
}

function viewPrevImage() {
  if (viewerState.currentIndex > 0) {
    viewerState.currentIndex--;
    loadViewerImage(appState.images[viewerState.currentIndex]);
  }
}

function zoomIn() {
  if (viewerState.scale < viewerState.maxScale) {
    viewerState.scale += 0.2;
    elements.viewerImage.style.transform = `scale(${viewerState.scale})`;
  }
}

function zoomOut() {
  if (viewerState.scale > viewerState.minScale) {
    viewerState.scale -= 0.2;
    elements.viewerImage.style.transform = `scale(${viewerState.scale})`;
  }
}

function resetZoom() {
  viewerState.scale = 1;
  elements.viewerImage.style.transform = `scale(${viewerState.scale})`;
}

function toggleSelectInViewer() {
  if (!viewerState.currentPath) return;
  
  const imageItem = document.querySelector(`.image-item[data-path="${viewerState.currentPath}"]`);
  if (imageItem) {
    toggleImageSelection(viewerState.currentPath, imageItem);
    updateViewerSelectIcon();
  }
}

function updateViewerSelectIcon() {
  if (viewerState.currentPath && appState.selectedImages.has(viewerState.currentPath)) {
    elements.viewerSelectIcon.textContent = '☑';
  } else {
    elements.viewerSelectIcon.textContent = '☐';
  }
}

// 初始化图片查看器事件
function initImageViewer() {
  // 查看器关闭按钮
  document.querySelector('.viewer-close').addEventListener('click', closeImageViewer);
  
  // 查看器覆盖层点击关闭
  document.querySelector('.viewer-overlay').addEventListener('click', closeImageViewer);
  
  // 导航按钮
  document.querySelector('.viewer-prev').addEventListener('click', viewPrevImage);
  document.querySelector('.viewer-next').addEventListener('click', viewNextImage);
  
  // 工具栏按钮
  document.getElementById('viewerZoomIn').addEventListener('click', zoomIn);
  document.getElementById('viewerZoomOut').addEventListener('click', zoomOut);
  document.getElementById('viewerZoomReset').addEventListener('click', resetZoom);
  document.getElementById('viewerToggleSelect').addEventListener('click', toggleSelectInViewer);
  
  // 键盘事件
  document.addEventListener('keydown', (e) => {
    if (!elements.imageViewer.classList.contains('hidden')) {
      switch (e.key) {
        case 'Escape':
          closeImageViewer();
          break;
        case 'ArrowLeft':
          viewPrevImage();
          break;
        case 'ArrowRight':
          viewNextImage();
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case '0':
          resetZoom();
          break;
        case ' ':
          e.preventDefault();
          toggleSelectInViewer();
          break;
      }
    }
  });
}

// 当页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 初始化应用
function init() {
  initEventListeners();
  initImageObserver();
  initImageViewer();
  updateImageZoom();
  loadState(); // 恢复上次保存的状态
}

