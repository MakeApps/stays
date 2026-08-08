/**
 * Removes anything the e2e suites create.
 *
 * Called at the START of each mutating suite as well as the end. Cleaning up
 * only afterwards is not enough: if a run dies midway, the leftover keeps a
 * condo code taken and the *next* run fails at its first create — which is
 * exactly the deadlock this replaced. A suite has to be able to run against a
 * dirty database.
 *
 * Runs inside the page so it reuses the session cookies rather than
 * re-authenticating.
 */

/** Names the suites create. Anything matching is fair game to delete. */
const TEST_NAME = /^(Playwright|Reuse Check|Duplicate)/;
const TEST_GUESTS = ["Sarah Chen", "Next Guest", "Clasher", "Diag Guest"];

export async function cleanupTestData(page) {
  return page.evaluate(
    async ({ guests }) => {
      const del = (path) =>
        fetch(path, {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "X-Requested-With": "fetch" },
        });
      const get = (path) =>
        fetch(path, { credentials: "same-origin" }).then((r) => r.json());

      const removed = { condos: 0, bookings: 0, expenses: 0 };

      // Bookings first: a condo cannot be removed while one references it.
      const bookings = await get("/api/v1/bookings?per_page=100");
      for (const b of bookings.items ?? []) {
        // The seeded Sarah Chen is in the current month; the suite's is later.
        const isTestBooking =
          guests.includes(b.guest_name) && b.check_in >= "2026-10-01";
        if (isTestBooking) {
          await del(`/api/v1/bookings/${b.id}`);
          removed.bookings += 1;
        }
      }

      const expenses = await get("/api/v1/expenses?per_page=100&q=Playwright");
      for (const e of expenses.items ?? []) {
        await del(`/api/v1/expenses/${e.id}`);
        removed.expenses += 1;
      }

      const condos = await get("/api/v1/condos?per_page=100");
      for (const c of condos.items ?? []) {
        if (!/^(Playwright|Reuse Check|Duplicate)/.test(c.name)) continue;
        await del(`/api/v1/condos/${c.id}`);
        removed.condos += 1;
      }

      return removed;
    },
    { guests: TEST_GUESTS },
  );
}

export { TEST_NAME, TEST_GUESTS };
