let actions = 0;
let submissions = 0;
const log = document.getElementById('actions');
for (const button of document.querySelectorAll('.specimen')) {
  button.addEventListener('click', () => { log.textContent = ++actions + ' kit actions'; });
}

// Exercise mixed shorthand, existing priorities, and style-src CSSOM restoration.
const variant = document.getElementById('button-variant');
variant.style.setProperty('padding', '8px 16px', 'important');
variant.style.setProperty('letter-spacing', '0.01em');

document.getElementById('form').addEventListener('submit', event => {
  event.preventDefault();
  document.getElementById('form-actions').textContent = ++submissions + ' submissions';
});

const root = document.getElementById('shadow-sample').attachShadow({ mode: 'open' });
const shadowButton = document.createElement('button');
shadowButton.id = 'shadow-button';
shadowButton.type = 'button';
shadowButton.textContent = 'Open shadow control';
shadowButton.style.setProperty('padding', '7px 11px');
root.append(shadowButton);

document.getElementById('remove-sample').addEventListener('click', () => {
  document.getElementById('remove-target')?.remove();
});

