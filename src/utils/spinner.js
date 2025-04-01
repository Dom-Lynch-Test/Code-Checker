import ora from 'ora';

/**
 * Creates a spinner with the given text
 * @param {string} text - Text to display next to the spinner
 * @returns {Object} - Spinner instance
 */
export function createSpinner(text) {
  return ora({
    text,
    color: 'blue',
    spinner: 'dots'
  }).start();
}
