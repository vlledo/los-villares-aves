const trigger = document.querySelector<HTMLButtonElement>('[data-menu-mobile-trigger]');
const panel = document.querySelector<HTMLElement>('[data-menu-mobile-panel]');

if (trigger && panel) {
	const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';

	const open = () => {
		trigger.setAttribute('aria-expanded', 'true');
		panel.hidden = false;
	};

	const close = () => {
		trigger.setAttribute('aria-expanded', 'false');
		panel.hidden = true;
	};

	trigger.addEventListener('click', () => {
		if (isOpen()) close();
		else open();
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && isOpen()) {
			close();
			trigger.focus();
		}
	});

	document.addEventListener('click', (event) => {
		if (!isOpen()) return;
		const header = trigger.closest('header');
		if (header && !header.contains(event.target as Node)) {
			close();
		}
	});

	panel.querySelectorAll('a').forEach((link) => {
		link.addEventListener('click', () => close());
	});
}
