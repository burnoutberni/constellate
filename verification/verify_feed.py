import time
from playwright.sync_api import sync_playwright

def verify_feed_page():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # Navigate to the feed page
            print("Navigating to feed page...")
            # Wait a bit for servers to start
            time.sleep(5)

            page.goto("http://localhost:5173")

            # Wait for content to load
            print("Waiting for content...")
            # We expect a "Home" heading or "Welcome!" message if empty
            # Or the spinner to disappear

            # Try to wait for the main heading
            page.wait_for_selector("h1", timeout=10000)

            # Take a screenshot
            screenshot_path = "verification/feed_page.png"
            page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"Error: {e}")
            # Take error screenshot
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_feed_page()
