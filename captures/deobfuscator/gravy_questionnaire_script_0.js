
const originalFetch = window.fetch.bind(window);
window.fetch = async (url, options = {}) => {
  if (String(url).includes('/__demo/eligibility')) {
    const input = JSON.parse(options.body || '{}');
    if ('dob' in input) {
      const dob = new Date(input.dob + 'T00:00:00');
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--;
      return new Response(JSON.stringify({eligible: Number.isFinite(dob.getTime()) && age >= 18}), {status:200, headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({eligible:true, affirmed:input.affirmed === true}), {status:200, headers:{'content-type':'application/json'}});
  }
  if (String(url).includes('/__demo/visible')) return new Response('{}', {status:200, headers:{'content-type':'application/json'}});
  return originalFetch(url, options);
};
