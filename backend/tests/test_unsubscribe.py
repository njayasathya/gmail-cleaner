import pytest
from app.gmail_service import GmailService
from app.unsubscribe_service import UnsubscribeService

def test_parse_unsubscribe_headers_one_click():
    gmail = GmailService()
    unsub_header = "<https://example.com/unsub?id=123>, <mailto:unsub@example.com?subject=unsubscribe>"
    unsub_post = "List-Unsubscribe=One-Click"
    
    http_url, mailto, has_one_click = gmail.parse_unsubscribe_header(unsub_header, unsub_post)
    
    assert http_url == "https://example.com/unsub?id=123"
    assert mailto == "mailto:unsub@example.com?subject=unsubscribe"
    assert has_one_click is True

def test_parse_unsubscribe_headers_mailto_only():
    gmail = GmailService()
    unsub_header = "<mailto:leave@newsletter.org?subject=quit>"
    
    http_url, mailto, has_one_click = gmail.parse_unsubscribe_header(unsub_header)
    
    assert http_url is None
    assert mailto == "mailto:leave@newsletter.org?subject=quit"
    assert has_one_click is False

def test_parse_unsubscribe_headers_empty():
    gmail = GmailService()
    http_url, mailto, has_one_click = gmail.parse_unsubscribe_header("")
    
    assert http_url is None
    assert mailto is None
    assert has_one_click is False
