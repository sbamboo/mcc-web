// Get element by ID 1_21_1_Frodomon_2025-05-29 and set image-rendering to 'pixelated' for all img children
addEventListener('DOMContentLoaded', () => {
    const frodomonElement = document.getElementById('1_21_1_Frodomon_2025-05-29');
    if (frodomonElement) {
        const images = frodomonElement.querySelectorAll('img');
        images.forEach(img => {
            img.style.imageRendering = 'pixelated';
        });
    }   
});