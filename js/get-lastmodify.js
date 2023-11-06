function getLastModifiedDate() {
    // Get the current script element
    const scripts = document.getElementsByTagName('script');
    const currentScript = scripts[scripts.length - 1]; // Just select the last one
  
    // Get the URL of the current HTML file
    const htmlFilePath = currentScript.src;
  
    // Make a fetch request to the HTML file
    fetch(htmlFilePath)
      .then(response => {
        if (response.ok) {
          const lastModified = new Date(response.headers.get('Last-Modified'));
          const formattedDate = lastModified.toISOString().split('T')[0]; // yyyy-mm-dd
          const buildDateElement = document.getElementById('website-build-date');
          buildDateElement.textContent = `Website Build: ${formattedDate}`;
        }
      })
      .catch(error => {
        console.error('Failed to fetch the last modified date, using preset. Error:', error);
      });
  }
  
  // Call the function to update the date when the page loads
  getLastModifiedDate();
  