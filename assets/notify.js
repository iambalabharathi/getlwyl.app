// Launch waiting list: send the email to Buttondown in the background and
// answer in place, so nobody leaves the site. Without JavaScript the form
// posts normally and Buttondown's own page answers.
document.querySelectorAll('form.notify').forEach(function (form) {
  var note = form.nextElementSibling;
  var button = form.querySelector('button');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    button.disabled = true;
    form.classList.add('is-sending');
    fetch(form.action, { method: 'POST', body: new FormData(form) })
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        form.hidden = true;
        note.textContent = 'Almost there — check your inbox and confirm your email. We’ll write once, when LWYL is on the App Store.';
        note.classList.add('is-done');
      })
      .catch(function () {
        note.innerHTML = 'Sorry, that didn’t go through. Please try again later, or email <a href="mailto:support@getlwyl.app">support@getlwyl.app</a>.';
        note.classList.add('is-error');
        button.disabled = false;
      })
      .finally(function () { form.classList.remove('is-sending'); });
  });
});
