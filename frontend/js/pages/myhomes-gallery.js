document.addEventListener('DOMContentLoaded', () => {
    const bigPhotoContainer = document.getElementById('big-photo-container');
    if (!bigPhotoContainer) return;

    const images = [
        'https://picsum.photos/id/1015/1200/675',
        'https://picsum.photos/id/1016/1200/675',
        'https://picsum.photos/id/1018/1200/675',
        'https://picsum.photos/id/102/1200/675',
        'https://picsum.photos/id/201/1200/675'
    ];

    let currentIndex = 0;
    const mainImg = document.getElementById('main-home-photo');
    const modal = document.getElementById('photo-modal');
    const modalImg = document.getElementById('modal-photo');
    const prevArrow = document.getElementById('prev-arrow');
    const nextArrow = document.getElementById('next-arrow');
    const closeModalButton = document.getElementById('close-modal');
    const modalPrev = document.getElementById('modal-prev');
    const modalNext = document.getElementById('modal-next');
    const addPhotoButton = document.getElementById('add-photo-btn');

    if (!mainImg || !modal || !modalImg || !prevArrow || !nextArrow || !closeModalButton || !modalPrev || !modalNext || !addPhotoButton) {
        return;
    }

    function updatePhoto() {
        mainImg.src = images[currentIndex];
    }

    prevArrow.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        updatePhoto();
    });

    nextArrow.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        currentIndex = (currentIndex + 1) % images.length;
        updatePhoto();
    });

    mainImg.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        modalImg.src = images[currentIndex];
        modal.classList.add('active');
    });

    closeModalButton.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modalPrev.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        modalImg.src = images[currentIndex];
    });

    modalNext.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % images.length;
        modalImg.src = images[currentIndex];
    });

    addPhotoButton.addEventListener('click', () => {
        alert('Add photos to collection – coming soon!');
    });

    document.addEventListener('keydown', (event) => {
        if (!modal.classList.contains('active')) return;
        if (event.key === 'Escape') modal.classList.remove('active');
        if (event.key === 'ArrowLeft') {
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            modalImg.src = images[currentIndex];
        }
        if (event.key === 'ArrowRight') {
            currentIndex = (currentIndex + 1) % images.length;
            modalImg.src = images[currentIndex];
        }
    });
});
