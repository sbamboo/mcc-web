// Function to parse URL parameters
function getParameterByName(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }
  
  function makeQueryStringSafe(inputString) {
    // Define a regular expression pattern that matches non-query-valid characters
    const regex = /[^a-zA-Z0-9\-_]/g;
    // Replace non-query-valid characters with underscores
    const safeString = inputString.replace(regex, '_');
    return safeString;
  }
  
  // Function to scroll to a specific element by its ID with an offset
  function scrollToElement(id, offset = 30) {
    const escapedId = makeQueryStringSafe(id);
    const element = document.getElementById(escapedId);
  
    if (element) {
      // Get the element's current position
      const elementRect = element.getBoundingClientRect();
      const absoluteElementTop = elementRect.top + window.scrollY;
  
      // Calculate the new scroll position with the specified offset
      const scrollPosition = absoluteElementTop - offset;
  
      // Scroll to the new position
      window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
    } else {
      // If the element is not found, set up a MutationObserver to watch for changes
      const observer = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'childList') {
            const updatedElement = document.getElementById(escapedId);
            if (updatedElement) {
              // Calculate the new scroll position with the specified offset
              const elementRect = updatedElement.getBoundingClientRect();
              const absoluteElementTop = elementRect.top + window.scrollY;
              const scrollPosition = absoluteElementTop - offset;
  
              // Scroll to the new position
              window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
              
              observer.disconnect(); // Stop observing once the element is found
              break;
            }
          }
        }
      });
  
      // Start observing changes in the entire document
      observer.observe(document, { childList: true, subtree: true });
    }
  }
  
  
  document.addEventListener('DOMContentLoaded', function () {
    // Get the "modpack" parameter from the URL
    const modpackParam = getParameterByName('modpack');
  
    // If "modpack" is unset or empty, set it to "none"
    const modpack = modpackParam ? modpackParam : 'none';
  
    // Scroll to the specified modpack div if it's not "none"
    if (modpack !== 'none') {
      scrollToElement(modpack);
    }
  });
  