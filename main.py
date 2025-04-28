# main.py
from fastapi import FastAPI, Request, Response, Form, Cookie, HTTPException, Depends, Query
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from typing import Optional, List, Dict, Any
import httpx
import bs4
from pydantic import BaseModel
import json
from datetime import datetime, timedelta
import io

app = FastAPI(title="PCMC Swimming Pool Proxy")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Base URL for the original website
BASE_URL = "https://pcmc.h2otechno.in"

# Client for making requests
client = httpx.AsyncClient(follow_redirects=True, timeout=30.0)

# Models
class Pool(BaseModel):
    id: int
    name: str
    description: str
    address: str
    image_url: str

class TimeSlot(BaseModel):
    time_slot: str
    date: str
    time: str
    amount: int
    available_slots: int
    is_available: bool

class User(BaseModel):
    name: str
    email: str = ""

class Booking(BaseModel):
    booking_number: str
    pool_name: str
    batch: str
    booking_date: str
    amount: str
    payment_status: str
    booking_status: str
    receipt_id: Optional[str] = None

# Helper function to check if user is logged in
async def get_current_user(ci_session: Optional[str] = Cookie(None)):
    if not ci_session:
        return None
    
    try:
        # Make a request to check if the session is valid
        headers = {"Cookie": f"ci_session={ci_session}"}
        response = await client.get(f"{BASE_URL}/index.php/", headers=headers)
        
        # Parse the response to check if user is logged in
        soup = bs4.BeautifulSoup(response.text, "html.parser")
        user_element = soup.select_one(".nm-title")
        
        if user_element:
            return User(name=user_element.text.strip(), email="")
    except Exception as e:
        print(f"Error checking user: {str(e)}")
    
    return None

# Routes
@app.get("/", response_class=HTMLResponse)
async def home(request: Request, user: Optional[User] = Depends(get_current_user)):
    return templates.TemplateResponse("index.html", {"request": request, "user": user})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(
    request: Request, 
    user: Optional[User] = Depends(get_current_user),
    status: Optional[str] = Query(None),
    sortField: Optional[str] = Query(None),
    sortOrder: Optional[str] = Query(None),
    page: int = Query(1)
):
    if not user:
        return RedirectResponse(url="/")
    
    return templates.TemplateResponse("dashboard.html", {"request": request, "user": user})

@app.get("/search", response_class=HTMLResponse)
async def search_page(
    request: Request, 
    user: Optional[User] = Depends(get_current_user),
    pool_id: Optional[int] = Query(None)
):
    return templates.TemplateResponse("search.html", {"request": request, "user": user, "pool_id": pool_id})

@app.get("/api/user")
async def get_user(user: Optional[User] = Depends(get_current_user)):
    if user:
        return user
    raise HTTPException(status_code=401, detail="Not authenticated")

@app.get("/api/pools")
async def get_pools(ci_session: Optional[str] = Cookie(None)):
    headers = {}
    if ci_session:
        headers["Cookie"] = f"ci_session={ci_session}"
    
    response = await client.get(f"{BASE_URL}/index.php/", headers=headers)
    
    # Parse the HTML to extract pool data
    soup = bs4.BeautifulSoup(response.text, "html.parser")
    pools = []
    
    for card in soup.select(".card"):
        pool_id = None
        pool_link = card.select_one("a[href*='/pool/']")
        if pool_link:
            pool_id = pool_link["href"].split("/")[-1]
        
        # Skip if we couldn't find the pool ID
        if not pool_id:
            continue
            
        name = card.select_one(".card-title").text.strip() if card.select_one(".card-title") else ""
        description = card.select_one(".card-text").text.strip() if card.select_one(".card-text") else ""
        image_url = card.select_one("img")["src"] if card.select_one("img") and card.select_one("img").has_attr("src") else ""
        
        # Make sure image URL is absolute
        if image_url and not image_url.startswith(("http://", "https://")):
            image_url = f"{BASE_URL}/{image_url.lstrip('/')}"
        
        pools.append({
            "id": int(pool_id),
            "name": name,
            "description": description,
            "address": description,
            "image_url": image_url
        })
    
    return pools

@app.get("/api/pool/{pool_id}")
async def get_pool_details(pool_id: int, ci_session: Optional[str] = Cookie(None)):
    headers = {}
    if ci_session:
        headers["Cookie"] = f"ci_session={ci_session}"
    
    response = await client.get(f"{BASE_URL}/index.php/pool/{pool_id}", headers=headers)
    
    # Parse the HTML to extract pool details
    soup = bs4.BeautifulSoup(response.text, "html.parser")
    
    name = soup.select_one(".pool-title").text.strip() if soup.select_one(".pool-title") else ""
    address = ""
    address_p = soup.select("p")
    if address_p and len(address_p) > 0:
        address = address_p[0].text.strip()
    
    image_url = ""
    img_element = soup.select_one(".carousel-item img")
    if img_element and img_element.has_attr("src"):
        image_url = img_element["src"]
        # Make sure image URL is absolute
        if not image_url.startswith(("http://", "https://")):
            image_url = f"{BASE_URL}/{image_url.lstrip('/')}"
    
    google_map_url = ""
    iframe = soup.select_one("iframe")
    if iframe and iframe.has_attr("src"):
        google_map_url = iframe["src"]
    
    return {
        "id": pool_id,
        "name": name,
        "description": "",
        "address": address,
        "image_url": image_url,
        "google_map_url": google_map_url
    }

@app.post("/api/login")
async def login(response: Response, email_or_aadhar: str = Form(...), password: str = Form(...)):
    try:
        # First, get a session cookie by visiting the login page
        login_page_response = await client.get(f"{BASE_URL}/index.php/user/login")
        
        # Get the initial session cookie
        initial_cookies = login_page_response.cookies.get("ci_session")
        
        # Prepare headers with the initial session
        headers = {
            "Cookie": f"ci_session={initial_cookies}",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        # Prepare login data
        login_data = {
            "email_or_aadhar": email_or_aadhar,
            "password": password
        }
        
        # Debug information
        print(f"Login URL: {BASE_URL}/index.php/user/authenticate")
        print(f"Login data: {login_data}")
        print(f"Login headers: {headers}")
        
        # Make the login request
        login_response = await client.post(
            f"{BASE_URL}/index.php/user/authenticate", 
            data=login_data,
            headers=headers,
            follow_redirects=False
        )
        
        # Debug information
        print(f"Login response status: {login_response.status_code}")
        print(f"Login response headers: {login_response.headers}")
        print(f"Login response cookies: {login_response.cookies}")
        
        # Check if login was successful
        if login_response.status_code == 302:  # Redirect on successful login
            # Extract the ci_session cookie
            new_session = login_response.cookies.get("ci_session")
            
            if new_session:
                # Set the cookie in our response
                response.set_cookie(
                    key="ci_session",
                    value=new_session,
                    httponly=True,
                    max_age=3600,  # 1 hour
                    path="/"
                )
                return {"success": True}
            
        # If we get here, check if we need to verify the login was successful
        verify_headers = {"Cookie": f"ci_session={login_response.cookies.get('ci_session', initial_cookies)}"}
        verify_response = await client.get(f"{BASE_URL}/index.php/", headers=verify_headers)
        
        # Check if the user is logged in by looking for the username in the response
        soup = bs4.BeautifulSoup(verify_response.text, "html.parser")
        user_element = soup.select_one(".nm-title")
        
        if user_element:
            # Login was successful, set the cookie
            response.set_cookie(
                key="ci_session",
                value=login_response.cookies.get("ci_session", initial_cookies),
                httponly=True,
                max_age=3600,  # 1 hour
                path="/"
            )
            return {"success": True, "user": user_element.text.strip()}
    
    except Exception as e:
        print(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")
    
    # If we get here, login failed
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/api/logout")
async def logout(response: Response):
    response.delete_cookie(key="ci_session")
    return {"success": True}

@app.post("/api/availability")
async def check_availability(
    pool_id: int = Form(...), 
    booking_date: str = Form(...),
    ci_session: Optional[str] = Cookie(None)
):
    if not ci_session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    headers = {
        "Cookie": f"ci_session={ci_session}",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    data = {
        "pool_id": str(pool_id),
        "booking_date": booking_date
    }
    
    print(f"Availability check URL: {BASE_URL}/index.php/availability")
    print(f"Availability data: {data}")
    print(f"Availability headers: {headers}")
    
    response = await client.post(
        f"{BASE_URL}/index.php/availability", 
        data=data,
        headers=headers
    )
    
    print(f"Availability response status: {response.status_code}")
    
    # Parse the HTML to extract availability data
    soup = bs4.BeautifulSoup(response.text, "html.parser")
    
    # Check if there are no available batches
    no_batches_msg = soup.select_one(".text-danger")
    if no_batches_msg:
        return {"batches": [], "message": no_batches_msg.text.strip()}
    
    # Extract available batches
    batches = []
    for card in soup.select(".card"):
        time_slot = card.select_one(".card-title").text.strip() if card.select_one(".card-title") else ""
        card_text = card.select_one(".card-text").text.strip() if card.select_one(".card-text") else ""
        
        # Parse the card text to extract details
        date_match = ""
        time_match = ""
        amount_match = "0"
        slots_match = "0"
        
        if "Date:" in card_text and "Time:" in card_text:
            date_match = card_text.split("Date:")[1].split("Time:")[0].strip()
            time_match = card_text.split("Time:")[1].split("Amount:")[0].strip() if "Amount:" in card_text else card_text.split("Time:")[1].strip()
        
        if "Amount:" in card_text and "Available Slots:" in card_text:
            amount_match = card_text.split("Amount:")[1].split("Available Slots:")[0].strip()
            slots_match = card_text.split("Available Slots:")[1].strip()
        
        is_available = not card.select_one("button[disabled]")
        
        try:
            amount = int(amount_match) if amount_match.isdigit() else 0
        except ValueError:
            amount = 0
            
        try:
            available_slots = int(slots_match) if slots_match.replace("-", "").isdigit() else 0
        except ValueError:
            available_slots = 0
        
        batches.append({
            "time_slot": time_slot,
            "date": date_match,
            "time": time_match,
            "amount": amount,
            "available_slots": available_slots,
            "is_available": is_available
        })
    
    return {"batches": batches, "message": ""}

@app.get("/api/bookings")
async def get_bookings(
    ci_session: Optional[str] = Cookie(None),
    status: Optional[str] = Query(None),
    sortField: Optional[str] = Query(None),
    sortOrder: Optional[str] = Query(None),
    page: int = Query(1)
):
    if not ci_session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Debug information
    print(f"Fetching bookings with session: {ci_session[:10]}...")
    print(f"Status filter: {status}")
    print(f"Sort field: {sortField}")
    print(f"Sort order: {sortOrder}")
    print(f"Page: {page}")
    
    # Construct the URL with query parameters
    url = f"{BASE_URL}/index.php/user/dashboard"
    params = []
    
    if status:
        params.append(f"status={status}")
    if sortField:
        params.append(f"sortField={sortField}")
    if sortOrder:
        params.append(f"sortOrder={sortOrder}")
    if page > 1:
        params.append(f"page={page}")
    
    if params:
        url += "?" + "&".join(params)
    
    print(f"Requesting URL: {url}")
    
    headers = {"Cookie": f"ci_session={ci_session}"}
    try:
        response = await client.get(url, headers=headers)
        print(f"Dashboard response status: {response.status_code}")
        
        # Parse the HTML to extract bookings
        soup = bs4.BeautifulSoup(response.text, "html.parser")
        bookings = []
        
        # Check if there's a table in the response
        table = soup.select_one("table tbody")
        if not table:
            print("No booking table found in response")
            return {
                "bookings": [],
                "pagination": {
                    "current_page": page,
                    "total_pages": 1
                },
                "filters": {
                    "status_options": []
                }
            }
        
        for row in soup.select("table tbody tr"):
            cells = row.select("td")
            if len(cells) < 8:
                continue
            
            booking_number = cells[0].text.strip()
            pool_name = cells[1].text.strip()
            batch = cells[2].text.strip()
            booking_date = cells[3].text.strip()
            amount = cells[4].text.strip()
            
            payment_status_elem = cells[5].select_one(".badge")
            payment_status = payment_status_elem.text.strip() if payment_status_elem else ""
            
            booking_status_elem = cells[6].select_one(".badge")
            booking_status = booking_status_elem.text.strip() if booking_status_elem else ""
            
            receipt_id = None
            receipt_link = cells[7].select_one("a[href*='downloadReceipt']")
            if receipt_link:
                receipt_url = receipt_link["href"]
                receipt_id = receipt_url.split("/")[-1]
            
            bookings.append({
                "booking_number": booking_number,
                "pool_name": pool_name,
                "batch": batch,
                "booking_date": booking_date,
                "amount": amount,
                "payment_status": payment_status,
                "booking_status": booking_status,
                "receipt_id": receipt_id
            })
        
        print(f"Found {len(bookings)} bookings")
        
        # Extract pagination info
        pagination = soup.select_one(".pagination")
        total_pages = 1
        if pagination:
            page_links = pagination.select("li a")
            if page_links:
                total_pages = len(page_links)
        
        # Extract filter options
        status_options = []
        status_select = soup.select_one("select[name='status']")
        if status_select:
            for option in status_select.select("option"):
                status_options.append({
                    "value": option.get("value", ""),
                    "text": option.text.strip(),
                    "selected": "selected" in option.attrs
                })
        
        return {
            "bookings": bookings,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages
            },
            "filters": {
                "status_options": status_options
            }
        }
    except Exception as e:
        print(f"Error fetching bookings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching bookings: {str(e)}")

@app.get("/api/receipt/{receipt_id}")
async def get_receipt(receipt_id: str, ci_session: Optional[str] = Cookie(None)):
    if not ci_session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        print(f"Fetching receipt {receipt_id} with session: {ci_session[:10]}...")
        
        headers = {"Cookie": f"ci_session={ci_session}"}
        response = await client.get(
            f"{BASE_URL}/payment/downloadReceipt/{receipt_id}", 
            headers=headers,
            follow_redirects=True
        )
        
        print(f"Receipt response status: {response.status_code}")
        print(f"Receipt content type: {response.headers.get('content-type', 'unknown')}")
        
        # Check if the response contains PDF content
        if response.status_code == 200 and (
            "application/pdf" in response.headers.get("content-type", "") or
            response.content.startswith(b"%PDF")
        ):
            # Return the PDF as a streaming response
            return StreamingResponse(
                io.BytesIO(response.content),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=receipt_{receipt_id}.pdf",
                    "Content-Length": str(len(response.content))
                }
            )
        
        # If we get here, it's not a valid PDF
        print("Response is not a valid PDF")
        raise HTTPException(status_code=400, detail="Receipt not available or not in PDF format")
    except Exception as e:
        print(f"Error fetching receipt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching receipt: {str(e)}")
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)