/* Image loading progress bar with percentage */
document.addEventListener('DOMContentLoaded', function() {
  const postImages = document.querySelectorAll('.post-content img');

  postImages.forEach(function(img) {
    if (img.parentElement.classList.contains('image-loading-wrapper')) return;
    if (img.getAttribute('data-loaded')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'image-loading-wrapper';

    const progressContainer = document.createElement('div');
    progressContainer.className = 'image-progress-container';

    const progressBar = document.createElement('div');
    progressBar.className = 'image-progress-bar';

    const progressText = document.createElement('span');
    progressText.className = 'image-progress-text';
    progressText.textContent = '0%';

    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(progressText);

    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(progressContainer);
    wrapper.appendChild(img);

    let progressHandled = false;

    const showLoaded = () => {
      if (progressHandled) return;
      progressHandled = true;
      progressText.textContent = '100%';
      progressBar.style.width = '100%';
      setTimeout(() => {
        wrapper.classList.add('loaded');
      }, 200);
    };

    // Try XHR for real progress
    const useXHR = () => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', img.src, true);

        xhr.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percent + '%';
            progressText.textContent = percent + '%';
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            // Use blob URL to ensure fresh load
            const blob = xhr.response;
            const blobUrl = URL.createObjectURL(blob);
            img.src = blobUrl;
            img.onload = showLoaded;
            img.onerror = showLoaded;
          } else {
            showLoaded();
          }
        };

        xhr.onerror = showLoaded;
        xhr.send();
        return true;
      } catch (e) {
        return false;
      }
    };

    // Fallback: use native load event
    img.onload = showLoaded;
    img.onerror = showLoaded;

    // Start XHR after a small delay to allow browser to start native load
    setTimeout(() => {
      if (!progressHandled) {
        useXHR();
      }
    }, 50);
  });
});