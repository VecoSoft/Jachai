import type { PreferredLanguage } from "./types";

// Flat key -> translated string. Add new keys here (both languages) as more
// of the UI gets translated; unknown keys just fall back to English, then
// to the raw key itself, so a missing translation never breaks rendering.
// {placeholders} inside a string are substituted from the `params` object
// passed to translate()/t() — e.g. "Resend in {n}s" + { n: 30 }.
// Exported so scripts/check-i18n-parity.mjs can assert en/bn key-set parity
// without duplicating the dictionary.
export const dictionary: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    // Navbar
    "nav.for_business": "For Business",
    "nav.admin": "Admin",
    "nav.account": "Account",
    "nav.account_settings": "Account Settings",
    "nav.my_reviews": "My Reviews",
    "nav.bookmarks": "Bookmarks",
    "nav.messages": "Messages",
    "nav.log_out": "Log out",
    "nav.log_in": "Log in",
    "nav.sign_up": "Sign up",
    "nav.theme": "Theme",

    // Account settings page
    "account.title": "Account settings",
    "account.mobile_number": "Mobile number",
    "account.name": "Name",
    "account.name_placeholder": "Your name",
    "account.profile_picture": "Profile picture",
    "account.uploading": "Uploading…",
    "account.community_avatar.label": "Community avatar",
    "account.community_avatar.hint": "Shown publicly next to your u/username on posts and comments — separate from your account photo above. Avoid a photo that could identify you if you want to stay anonymous.",
    "account.community_avatar.no_username_hint": "Set up a Community username first (from the Community section) to add an avatar for it.",
    "account.community_avatar.remove": "Remove",
    "account.community_avatar.toast.updated": "Community avatar updated",
    "account.language": "Language",
    "account.language.en": "English",
    "account.language.bn": "বাংলা",
    "account.appearance": "Appearance",
    "account.theme.light": "Light",
    "account.theme.dark": "Dark",
    "account.save": "Save",
    "account.toast.updated": "Profile updated",

    // Login / signup / forgot-password modal (shared)
    "modal.login.heading": "Welcome back",
    "modal.login.description": "Continue to your account.",
    "modal.signup.heading": "Create your account",
    "modal.signup.description": "Join the trusted local business community.",
    "modal.forgot_password.heading": "Reset your password",
    "modal.forgot_password.description": "We'll text you a one-time code to confirm it's you.",
    "modal.illustration.title": "Find a business you can actually trust",
    "modal.illustration.subtitle":
      "Verified local businesses, real reviews, and a platform built for Bangladesh.",

    // Shared auth fields/labels
    "auth.mobile_number": "Mobile number",
    "auth.password": "Password",
    "auth.confirm_password": "Confirm password",
    "auth.new_password": "New password",
    "auth.confirm_new_password": "Confirm new password",
    "auth.otp_code_label": "6-digit code",
    "auth.sent_to": "Sent to {phone}",
    "auth.hint.min_8_chars": "At least 8 characters.",

    // Login form
    "auth.forgot_password": "Forgot password?",
    "auth.no_account": "Don't have an account?",

    // Signup form
    "auth.have_account": "Already have an account?",
    "auth.verify_create_account": "Verify & create account",
    "auth.back": "← Back",
    "auth.resend_in": "Resend in {n}s",
    "auth.resend_code": "Resend code",

    // Forgot-password form
    "auth.change_number": "← Change number",
    "auth.reset_password_button": "Reset password",
    "auth.send_code": "Send code",
    "auth.remembered_password": "Remembered your password?",

    // Validation errors
    "auth.error.invalid_phone": "Enter a valid Bangladeshi mobile number (e.g. 01712345678).",
    "auth.error.enter_password": "Enter your password.",
    "auth.error.password_min": "Password must be at least 8 characters.",
    "auth.error.passwords_mismatch": "Passwords do not match.",
    "auth.error.enter_code": "Enter the code you received.",
    "auth.error.too_many_otp": "Too many OTP requests — please wait before trying again.",
    "auth.error.enter_name": "Enter your name.",

    // Toasts
    "auth.toast.logged_in": "Logged in",
    "auth.toast.otp_sent": "OTP sent — it expires in 5 minutes.",
    "auth.toast.account_created": "Account created",
    "auth.toast.password_reset": "Password reset",

    "button.create_account": "Create account",

    // Shared across cards/badges (business-card, similar-business-card, and
    // more as later i18n passes reuse them) — kept in one place so wording
    // can't drift apart per-file.
    "common.verified": "Verified",
    "common.flagged": "Flagged",
    "common.view_details": "View details",
    "common.see_more": "See more",
    "common.see_less": "See less",
    "common.stars_out_of_5": "{rating} out of 5 stars",
    "common.reaction.like": "Like",
    "common.reaction.dislike": "Dislike",
    "common.reaction.love": "Love",
    "common.reaction.wow": "Wow",
    "common.badge.trending": "Trending",
    "common.badge.most_loved": "Most loved",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.optional": "optional",
    "common.uploading": "Uploading…",
    "common.selected_file": "Selected: {name}",

    // business-card.tsx
    "business_card.review_count.one": "{n} review",
    "business_card.review_count.other": "{n} reviews",
    "business_card.rating_count.one": "{n} rating",
    "business_card.rating_count.other": "{n} ratings",
    "business_card.new_no_reviews": "New · no reviews yet",
    "business_card.new": "New",
    "business_card.open": "Open",
    "business_card.closed": "Closed",
    "business_card.closed_opens": "Closed · opens {time}",

    // brand-card.tsx
    "brand_card.branch_count.one": "{n} branch",
    "brand_card.branch_count.other": "{n} branches",

    // review-card.tsx
    "review_card.confirm_delete": "Delete this review? This cannot be undone after the 72-hour window closes.",
    "review_card.toast.deleted": "Review deleted",
    "review_card.not_recommended": "Not currently recommended",
    "review_card.anonymous_reviewer": "reviewer {id}",
    "review_card.read_more": "Read more",
    "review_card.mark_useful": "Mark useful",
    "review_card.mark_funny": "Mark funny",
    "review_card.mark_cool": "Mark cool",
    "review_card.useful_short": "Useful",
    "review_card.funny_short": "Funny",
    "review_card.cool_short": "Cool",
    "review_card.edit_window_closed": "72h edit window closed",
    "review_card.owner_response": "Response from the owner",

    // owner/reviews-panel.tsx
    "reviews_panel.confirm_delete_reply": "Delete this reply? It will no longer be visible to visitors.",
    "reviews_panel.reply_placeholder": "Thank the customer, address their feedback, or clarify a misunderstanding…",
    "reviews_panel.your_reply": "Your reply",
    "reviews_panel.reply_publicly": "Reply publicly",
    "reviews_panel.continue_by_message": "Continue by private message",

    // business-form.tsx
    "business_form.error.geolocation_unsupported": "Geolocation is not supported by this browser.",
    "business_form.error.location_unavailable": "Unable to get your location.",
    "business_form.error.invalid_image_type": "Please select a JPG, PNG, or WebP image.",
    "business_form.error.required_fields": "Please fill in name, category, city, area, and contact number.",
    "business_form.toast.updated_hours_failed": "Listing updated, but hours failed to save. You can try again from here.",
    "business_form.toast.updated": "Listing updated",
    "business_form.toast.created_hours_failed": "Listing created, but hours failed to save. You can add them from Edit.",
    "business_form.toast.cover_uploaded": "Cover photo uploaded successfully.",
    "business_form.toast.logo_uploaded": "Profile picture uploaded successfully.",
    "business_form.toast.created_with_photos": "Listing and photos created successfully.",
    "business_form.toast.created_photo_failed": "Listing created, but a photo failed to upload. You can add it from Edit.",
    "business_form.toast.created": "Listing created",
    "business_form.toast.created_category_details_failed": "Listing created, but some category details didn't save. Add them from Edit.",

    "business_form.section.basic_info.title": "Basic information",
    "business_form.section.basic_info.description": "Tell customers what this business is called and does.",
    "business_form.section.location.title": "Location",
    "business_form.section.location.description": "Where customers can find you, plus a map pin for search & directions.",
    "business_form.section.contact_details.title": "Contact & details",
    "business_form.section.contact_details.description": "How to reach you and what to expect when customers visit.",
    "business_form.section.presence.title": "Business presence",
    "business_form.section.presence.description":
      "Help customers connect with your business online. Every field here is optional — anything you leave blank simply won't appear on your public page.",
    "business_form.section.category_details.title": "Category details",
    "business_form.section.category_details.description": "Optional sections tailored to your type of business.",
    "business_form.section.category_details.description_with_category": "Optional showcase sections for a {category} — {modules}.",
    "business_form.section.photos.title": "Photos",
    "business_form.section.photos.description":
      "A gallery of up to 10 photos — storefront, interior, team, or work samples. Cover photo and profile picture are set in step 3.",
    "business_form.section.faq.title": "FAQ",
    "business_form.section.faq.description": "Pre-answer common questions so customers get an instant answer instead of messaging you.",

    "business_form.field.business_name": "Business name",
    "business_form.field.business_name_placeholder": "e.g. Dhanmondi Hair Salon",
    "business_form.field.category": "Category",
    "business_form.field.select_category": "Select category",
    "business_form.field.price_tier": "Price tier",
    "business_form.field.brand": "Part of a chain? (optional)",
    "business_form.field.brand_none": "No",
    "business_form.field.brand_existing": "Link to a chain I already manage",
    "business_form.field.brand_new": "Start a new chain",
    "business_form.field.select_brand": "Select chain",
    "business_form.field.brand_new_placeholder": "e.g. KFC",
    "business_form.field.brand_hint": "Groups this listing with your other branches of the same chain — combined rating, one search result, a branch switcher on the page.",
    "business_form.field.city": "City",
    "business_form.field.select_city": "Select city",
    "business_form.field.area": "Area",
    "business_form.field.select_area": "Select area",
    "business_form.field.use_my_location": "Use my current location as the pin",
    "business_form.field.location_hint": "Spec §17a: precise lat/lng, set via the map above — click, drag the pin, or search an address.",
    "business_form.field.contact_number": "Contact number",
    "business_form.field.operating_hours": "Operating hours",
    "business_form.field.description": "Description",
    "business_form.field.description_placeholder": "What makes this business worth visiting?",
    "business_form.field.established_year": "Established year",
    "business_form.field.established_year_placeholder": "e.g. 2015",
    "business_form.field.cover_photo": "Cover photo",
    "business_form.field.profile_picture": "Profile picture",
    "business_form.field.profile_picture_hint":
      "Shown as a circular badge on your listing's card — a headshot or logo, separate from the cover/gallery photos.",
    "business_form.field.attributes": "Attributes",
    "business_form.field.website": "Website",
    "business_form.field.whatsapp": "WhatsApp number",
    "business_form.field.use_contact_for_whatsapp": "Use contact number for WhatsApp",
    "business_form.field.email": "Email address",
    "business_form.field.facebook": "Facebook",
    "business_form.field.instagram": "Instagram",
    "business_form.field.pick_category_hint": "Pick a category in step 1 to see the sections relevant to your business.",
    "business_form.field.category_details_save_hint":
      "These save when you create the listing. Photos for each item can be added afterwards from your dashboard.",
    "business_form.field.photos_save_hint":
      "Save your listing first — you can add gallery photos straight after, from your dashboard or by editing this listing.",
    "business_form.field.faq_save_hint": "Save your listing first — you can add FAQ entries straight after, from your dashboard or by editing this listing.",

    "business_form.action.save_changes": "Save changes",
    "business_form.action.create_listing": "Create listing",

    // hours-exceptions-manager.tsx
    "hours_exceptions.section_title": "Holiday & exception hours",
    "hours_exceptions.empty": "No holidays or special hours set.",
    "hours_exceptions.add": "Add a date",
    "hours_exceptions.closed": "Closed",
    "hours_exceptions.special_hours": "Special hours",
    "hours_exceptions.field.start_date": "From",
    "hours_exceptions.field.end_date": "To",
    "hours_exceptions.field.reason": "Reason (optional)",
    "hours_exceptions.reason_placeholder": "e.g. Eid holiday",
    "hours_exceptions.confirm_delete": "Remove this date? Regular weekly hours will apply again.",
    "hours_exceptions.error.date_required": "Pick a date first.",
    "hours_exceptions.error.time_required": "Set an open and close time, or mark it closed.",

    // review-form.tsx
    "review_form.error.max_photos": "You can attach up to {max} photos.",
    "review_form.error.invalid_type": "{name}: only JPG, PNG, or WEBP photos are allowed.",
    "review_form.error.too_large": "{name}: must be under {max}MB.",
    "review_form.error.rating_required": "Please select a star rating.",
    "review_form.error.content_too_short": "Please write at least {min} characters about your experience.",
    "review_form.that_photo": "That photo",
    "review_form.photo": "Photo",
    "review_form.toast.updated": "Review updated",
    "review_form.toast.submitted": "Review submitted",
    "review_form.heading_edit": "Edit your review",
    "review_form.heading_write": "Write a review",
    "review_form.content_placeholder": "Share details of your experience — what went well, what didn't.",
    "review_form.add_photos": "Add photos",
    "review_form.camera": "Camera",
    "review_form.gallery": "Gallery",
    "review_form.remove_photo": "Remove photo",
    "review_form.save_changes": "Save changes",
    "review_form.submit_review": "Submit review",

    // booking-modal.tsx
    "booking.log_in_to_book": "Log in to book",
    "booking.sign_in_prompt": "Sign in to request an appointment with {business}.",
    "booking.appointment_confirmed": "Appointment confirmed",
    "booking.booking_requested": "Booking requested",
    "booking.confirmed_with": "{number} is confirmed with {business}.",
    "booking.will_confirm_soon": "{business} will confirm {number} soon.",
    "booking.track_hint": "You can track it from My bookings.",
    "booking.view_booking": "View booking",
    "booking.heading_book": "Book {service}",
    "booking.approx_duration": "Approximately {minutes} minutes",
    "booking.no_staff": "No staff are currently available for this service.",
    "booking.field.staff": "Staff",
    "booking.any_staff": "Any available staff",
    "booking.field.date": "Date",
    "booking.field.available_time": "Available time",
    "booking.no_slots": "No available times for this staff member on this date.",
    "booking.slot_booked": "Booked",
    "booking.field.name": "Name",
    "booking.field.phone": "Phone",
    "booking.field.note": "Note",
    "booking.note_placeholder": "Anything the business should know…",
    "booking.book_at_time": "Book {time}",
    "booking.select_time": "Select a time",

    // message-owner-card.tsx
    "message_owner.heading": "Message the owner",
    "message_owner.subheading": "Usually the fastest way to get an answer",
    "message_owner.own_business_note": "This is your listing. Customer messages arrive in your owner inbox.",
    "message_owner.login_prompt": "Log in to send {business} a private message.",
    "message_owner.login_to_message": "Log in to message",
    "message_owner.sent_heading": "Message sent",
    "message_owner.sent_description": "The owner will see it in their inbox and can reply to you there.",
    "message_owner.send_another": "Send another",
    "message_owner.open_answer_suffix": "You can still send a message below for anything else.",
    "message_owner.compose_placeholder": "Ask about pricing, availability, or booking…",
    "message_owner.private_hint": "Only the owner can see this",
    "message_owner.send_message": "Send message",
    "message_owner.prompt.prices": "What are your prices?",
    "message_owner.prompt.open_now": "Are you open right now?",
    "message_owner.prompt.bookings": "Do you take bookings?",
    "message_owner.prompt.location": "Where exactly are you located?",
    "message_owner.open_status.open_until": "Yes, open now until {time}.",
    "message_owner.open_status.open_no_time": "Yes, open now.",
    "message_owner.open_status.closed_opens": "Closed right now — opens {time}.",
    "message_owner.open_status.closed_no_time": "Closed right now.",
  },
  bn: {
    // Navbar
    "nav.for_business": "ব্যবসার জন্য",
    "nav.admin": "অ্যাডমিন",
    "nav.account": "অ্যাকাউন্ট",
    "nav.account_settings": "অ্যাকাউন্ট সেটিংস",
    "nav.my_reviews": "আমার রিভিউ",
    "nav.bookmarks": "বুকমার্ক",
    "nav.messages": "মেসেজ",
    "nav.log_out": "লগ আউট",
    "nav.log_in": "লগ ইন",
    "nav.sign_up": "সাইন আপ",
    "nav.theme": "থিম",

    // Account settings page
    "account.title": "অ্যাকাউন্ট সেটিংস",
    "account.mobile_number": "মোবাইল নম্বর",
    "account.name": "নাম",
    "account.name_placeholder": "আপনার নাম",
    "account.profile_picture": "প্রোফাইল ছবি",
    "account.uploading": "আপলোড হচ্ছে…",
    "account.community_avatar.label": "কমিউনিটি অ্যাভাটার",
    "account.community_avatar.hint": "পোস্ট আর কমেন্টে আপনার u/username এর পাশে সবার জন্য দেখা যাবে — উপরের অ্যাকাউন্ট ছবি থেকে আলাদা। পরিচয় গোপন রাখতে চাইলে এমন ছবি এড়িয়ে চলুন যা আপনাকে চেনা যায়।",
    "account.community_avatar.no_username_hint": "অ্যাভাটার যোগ করতে আগে কমিউনিটি সেকশন থেকে একটি কমিউনিটি ইউজারনেম সেট করুন।",
    "account.community_avatar.remove": "মুছে ফেলুন",
    "account.community_avatar.toast.updated": "কমিউনিটি অ্যাভাটার আপডেট হয়েছে",
    "account.language": "ভাষা",
    "account.language.en": "English",
    "account.language.bn": "বাংলা",
    "account.appearance": "থিম",
    "account.theme.light": "হালকা",
    "account.theme.dark": "গাঢ়",
    "account.save": "সংরক্ষণ করুন",
    "account.toast.updated": "প্রোফাইল আপডেট হয়েছে",

    // Login / signup / forgot-password modal (shared)
    "modal.login.heading": "স্বাগতম",
    "modal.login.description": "আপনার অ্যাকাউন্টে যান।",
    "modal.signup.heading": "আপনার অ্যাকাউন্ট তৈরি করুন",
    "modal.signup.description": "বিশ্বস্ত স্থানীয় ব্যবসায়ী কমিউনিটিতে যোগ দিন।",
    "modal.forgot_password.heading": "পাসওয়ার্ড রিসেট করুন",
    "modal.forgot_password.description": "আপনার পরিচয় নিশ্চিত করতে আমরা একটি ওটিপি কোড পাঠাব।",
    "modal.illustration.title": "এমন ব্যবসা খুঁজুন যাকে সত্যিই বিশ্বাস করা যায়",
    "modal.illustration.subtitle":
      "এনআইডি-ভেরিফাইড স্থানীয় ব্যবসা, প্রকৃত রিভিউ, এবং বাংলাদেশের জন্য তৈরি একটি প্ল্যাটফর্ম।",

    // Shared auth fields/labels
    "auth.mobile_number": "মোবাইল নম্বর",
    "auth.password": "পাসওয়ার্ড",
    "auth.confirm_password": "পাসওয়ার্ড নিশ্চিত করুন",
    "auth.new_password": "নতুন পাসওয়ার্ড",
    "auth.confirm_new_password": "নতুন পাসওয়ার্ড নিশ্চিত করুন",
    "auth.otp_code_label": "৬-সংখ্যার কোড",
    "auth.sent_to": "পাঠানো হয়েছে {phone}",
    "auth.hint.min_8_chars": "কমপক্ষে ৮ অক্ষর।",

    // Login form
    "auth.forgot_password": "পাসওয়ার্ড ভুলে গেছেন?",
    "auth.no_account": "অ্যাকাউন্ট নেই?",

    // Signup form
    "auth.have_account": "ইতিমধ্যে অ্যাকাউন্ট আছে?",
    "auth.verify_create_account": "যাচাই করুন ও অ্যাকাউন্ট তৈরি করুন",
    "auth.back": "← পেছনে",
    "auth.resend_in": "{n} সেকেন্ডে আবার পাঠান",
    "auth.resend_code": "আবার কোড পাঠান",

    // Forgot-password form
    "auth.change_number": "← নম্বর পরিবর্তন করুন",
    "auth.reset_password_button": "পাসওয়ার্ড রিসেট করুন",
    "auth.send_code": "কোড পাঠান",
    "auth.remembered_password": "পাসওয়ার্ড মনে পড়েছে?",

    // Validation errors
    "auth.error.invalid_phone": "সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন ০১৭১২৩৪৫৬৭৮)।",
    "auth.error.enter_password": "আপনার পাসওয়ার্ড দিন।",
    "auth.error.password_min": "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।",
    "auth.error.passwords_mismatch": "পাসওয়ার্ড মিলছে না।",
    "auth.error.enter_code": "প্রাপ্ত কোডটি দিন।",
    "auth.error.enter_name": "আপনার নাম লিখুন।",
    "auth.error.too_many_otp": "অনেকবার ওটিপি চাওয়া হয়েছে — একটু পর আবার চেষ্টা করুন।",

    // Toasts
    "auth.toast.logged_in": "লগইন সফল হয়েছে",
    "auth.toast.otp_sent": "ওটিপি পাঠানো হয়েছে — এটি ৫ মিনিটে মেয়াদ শেষ হবে।",
    "auth.toast.account_created": "অ্যাকাউন্ট তৈরি হয়েছে",
    "auth.toast.password_reset": "পাসওয়ার্ড রিসেট হয়েছে",

    "button.create_account": "অ্যাকাউন্ট তৈরি করুন",

    // Shared across cards/badges — see the "common.*" block in the en dictionary above.
    "common.verified": "ভেরিফাইড",
    "common.flagged": "চিহ্নিত",
    "common.view_details": "বিস্তারিত দেখুন",
    "common.see_more": "আরও দেখুন",
    "common.see_less": "কম দেখুন",
    "common.stars_out_of_5": "৫ তারকার মধ্যে {rating} তারকা",
    "common.reaction.like": "লাইক",
    "common.reaction.dislike": "ডিসলাইক",
    "common.reaction.love": "ভালোবাসা",
    "common.reaction.wow": "বাহ",
    "common.badge.trending": "ট্রেন্ডিং",
    "common.badge.most_loved": "সবচেয়ে পছন্দের",
    "common.edit": "সম্পাদনা",
    "common.delete": "মুছে ফেলুন",
    "common.save": "সংরক্ষণ করুন",
    "common.cancel": "বাতিল",
    "common.close": "বন্ধ করুন",
    "common.optional": "ঐচ্ছিক",
    "common.uploading": "আপলোড হচ্ছে…",
    "common.selected_file": "নির্বাচিত: {name}",

    // business-card.tsx — Bangla has no one/other cardinal split (see
    // translateCount() in this file), so only ".other" is needed.
    "business_card.review_count.other": "{n}টি রিভিউ",
    "business_card.rating_count.other": "{n}টি রেটিং",
    "business_card.new_no_reviews": "নতুন · এখনো কোনো রিভিউ নেই",
    "business_card.new": "নতুন",
    "business_card.open": "খোলা",
    "business_card.closed": "বন্ধ",
    "business_card.closed_opens": "বন্ধ · খুলবে {time}",

    // brand-card.tsx
    "brand_card.branch_count.other": "{n}টি শাখা",

    // review-card.tsx
    "review_card.confirm_delete": "এই রিভিউটি মুছে ফেলতে চান? ৭২ ঘণ্টার সময়সীমা শেষ হওয়ার পর এটি আর ফেরানো যাবে না।",
    "review_card.toast.deleted": "রিভিউ মুছে ফেলা হয়েছে",
    "review_card.not_recommended": "বর্তমানে সুপারিশকৃত নয়",
    "review_card.anonymous_reviewer": "রিভিউয়ার {id}",
    "review_card.read_more": "আরও পড়ুন",
    "review_card.mark_useful": "উপকারী চিহ্নিত করুন",
    "review_card.mark_funny": "মজার চিহ্নিত করুন",
    "review_card.mark_cool": "দারুণ চিহ্নিত করুন",
    "review_card.useful_short": "উপকারী",
    "review_card.funny_short": "মজার",
    "review_card.cool_short": "দারুণ",
    "review_card.edit_window_closed": "৭২ ঘণ্টার সম্পাদনা সময় শেষ",
    "review_card.owner_response": "মালিকের উত্তর",

    // owner/reviews-panel.tsx
    "reviews_panel.confirm_delete_reply": "এই উত্তরটি মুছে ফেলতে চান? এটি আর ভিজিটরদের কাছে দৃশ্যমান থাকবে না।",
    "reviews_panel.reply_placeholder": "গ্রাহককে ধন্যবাদ জানান, তাদের মতামতের জবাব দিন, অথবা কোনো ভুল বোঝাবুঝি পরিষ্কার করুন…",
    "reviews_panel.your_reply": "আপনার উত্তর",
    "reviews_panel.reply_publicly": "পাবলিকলি উত্তর দিন",
    "reviews_panel.continue_by_message": "ব্যক্তিগত মেসেজে চালিয়ে যান",

    // business-form.tsx
    "business_form.error.geolocation_unsupported": "এই ব্রাউজারে লোকেশন সুবিধা সাপোর্ট করে না।",
    "business_form.error.location_unavailable": "আপনার অবস্থান শনাক্ত করা যায়নি।",
    "business_form.error.invalid_image_type": "অনুগ্রহ করে JPG, PNG অথবা WebP ছবি নির্বাচন করুন।",
    "business_form.error.required_fields": "অনুগ্রহ করে নাম, ক্যাটাগরি, শহর, এলাকা এবং যোগাযোগ নম্বর পূরণ করুন।",
    "business_form.toast.updated_hours_failed": "লিস্টিং আপডেট হয়েছে, কিন্তু সময়সূচী সংরক্ষণ করা যায়নি। এখান থেকে আবার চেষ্টা করুন।",
    "business_form.toast.updated": "লিস্টিং আপডেট হয়েছে",
    "business_form.toast.created_hours_failed": "লিস্টিং তৈরি হয়েছে, কিন্তু সময়সূচী সংরক্ষণ করা যায়নি। Edit থেকে যোগ করতে পারবেন।",
    "business_form.toast.cover_uploaded": "কভার ছবি সফলভাবে আপলোড হয়েছে।",
    "business_form.toast.logo_uploaded": "প্রোফাইল ছবি সফলভাবে আপলোড হয়েছে।",
    "business_form.toast.created_with_photos": "লিস্টিং ও ছবি সফলভাবে তৈরি হয়েছে।",
    "business_form.toast.created_photo_failed": "লিস্টিং তৈরি হয়েছে, কিন্তু ছবি আপলোড ব্যর্থ হয়েছে। Edit থেকে যোগ করতে পারবেন।",
    "business_form.toast.created": "লিস্টিং তৈরি হয়েছে",
    "business_form.toast.created_category_details_failed": "লিস্টিং তৈরি হয়েছে, কিন্তু কিছু ক্যাটাগরি তথ্য সংরক্ষণ করা যায়নি। Edit থেকে যোগ করুন।",

    "business_form.section.basic_info.title": "মৌলিক তথ্য",
    "business_form.section.basic_info.description": "গ্রাহকদের জানান এই ব্যবসার নাম ও কাজ কী।",
    "business_form.section.location.title": "অবস্থান",
    "business_form.section.location.description": "গ্রাহকরা আপনাকে কোথায় খুঁজে পাবে, এবং সার্চ ও দিকনির্দেশনার জন্য একটি ম্যাপ পিন।",
    "business_form.section.contact_details.title": "যোগাযোগ ও বিস্তারিত",
    "business_form.section.contact_details.description": "গ্রাহকরা কীভাবে যোগাযোগ করবে এবং ভিজিটে কী আশা করবে।",
    "business_form.section.presence.title": "অনলাইন উপস্থিতি",
    "business_form.section.presence.description":
      "গ্রাহকদের অনলাইনে আপনার ব্যবসার সাথে যুক্ত হতে সাহায্য করুন। এখানকার প্রতিটি ফিল্ড ঐচ্ছিক — যা খালি রাখবেন তা আপনার পাবলিক পেজে দেখাবে না।",
    "business_form.section.category_details.title": "ক্যাটাগরি বিস্তারিত",
    "business_form.section.category_details.description": "আপনার ব্যবসার ধরন অনুযায়ী ঐচ্ছিক সেকশন।",
    "business_form.section.category_details.description_with_category": "{category}-এর জন্য ঐচ্ছিক শোকেস সেকশন — {modules}।",
    "business_form.section.photos.title": "ছবি",
    "business_form.section.photos.description":
      "সর্বোচ্চ ১০টি ছবির গ্যালারি — দোকানের সামনের অংশ, ভেতরের অংশ, টিম, অথবা কাজের নমুনা। কভার ছবি ও প্রোফাইল ছবি ৩নং ধাপে সেট করা হয়।",
    "business_form.section.faq.title": "সচরাচর জিজ্ঞাসিত প্রশ্ন",
    "business_form.section.faq.description": "সাধারণ প্রশ্নের উত্তর আগে থেকেই দিন, যাতে গ্রাহকরা মেসেজ না করেই সাথে সাথে উত্তর পান।",

    "business_form.field.business_name": "ব্যবসার নাম",
    "business_form.field.business_name_placeholder": "যেমন: ধানমন্ডি হেয়ার সেলুন",
    "business_form.field.category": "ক্যাটাগরি",
    "business_form.field.select_category": "ক্যাটাগরি নির্বাচন করুন",
    "business_form.field.price_tier": "মূল্য পরিসীমা",
    "business_form.field.brand": "এটি কি কোনো চেইনের অংশ? (ঐচ্ছিক)",
    "business_form.field.brand_none": "না",
    "business_form.field.brand_existing": "আমার পরিচালিত চেইনের সাথে যুক্ত করুন",
    "business_form.field.brand_new": "নতুন চেইন শুরু করুন",
    "business_form.field.select_brand": "চেইন নির্বাচন করুন",
    "business_form.field.brand_new_placeholder": "যেমন: KFC",
    "business_form.field.brand_hint": "একই চেইনের অন্যান্য শাখার সাথে এই লিস্টিংটি যুক্ত হবে — একত্রিত রেটিং, একটি সার্চ রেজাল্ট, পেজে ব্রাঞ্চ সুইচার।",
    "business_form.field.city": "শহর",
    "business_form.field.select_city": "শহর নির্বাচন করুন",
    "business_form.field.area": "এলাকা",
    "business_form.field.select_area": "এলাকা নির্বাচন করুন",
    "business_form.field.use_my_location": "আমার বর্তমান অবস্থান পিন হিসেবে ব্যবহার করুন",
    "business_form.field.location_hint": "স্পেক §17a: সঠিক lat/lng, উপরের ম্যাপের মাধ্যমে সেট করুন — ক্লিক করুন, পিন টেনে সরান, অথবা ঠিকানা খুঁজুন।",
    "business_form.field.contact_number": "যোগাযোগ নম্বর",
    "business_form.field.operating_hours": "কার্যক্রমের সময়",
    "business_form.field.description": "বিবরণ",
    "business_form.field.description_placeholder": "এই ব্যবসাটি ঘুরে দেখার মতো কী বিশেষত্ব আছে?",
    "business_form.field.established_year": "প্রতিষ্ঠার বছর",
    "business_form.field.established_year_placeholder": "যেমন: ২০১৫",
    "business_form.field.cover_photo": "কভার ছবি",
    "business_form.field.profile_picture": "প্রোফাইল ছবি",
    "business_form.field.profile_picture_hint":
      "আপনার লিস্টিং কার্ডে গোলাকার ব্যাজ হিসেবে দেখানো হয় — একটি হেডশট বা লোগো, কভার/গ্যালারি ছবি থেকে আলাদা।",
    "business_form.field.attributes": "বৈশিষ্ট্য",
    "business_form.field.website": "ওয়েবসাইট",
    "business_form.field.whatsapp": "হোয়াটসঅ্যাপ নম্বর",
    "business_form.field.use_contact_for_whatsapp": "হোয়াটসঅ্যাপের জন্য যোগাযোগ নম্বর ব্যবহার করুন",
    "business_form.field.email": "ইমেইল ঠিকানা",
    "business_form.field.facebook": "ফেসবুক",
    "business_form.field.instagram": "ইনস্টাগ্রাম",
    "business_form.field.pick_category_hint": "আপনার ব্যবসার সাথে প্রাসঙ্গিক সেকশনগুলো দেখতে ধাপ ১-এ একটি ক্যাটাগরি নির্বাচন করুন।",
    "business_form.field.category_details_save_hint":
      "লিস্টিং তৈরি করার সময় এগুলো সংরক্ষণ হয়। প্রতিটি আইটেমের ছবি পরে আপনার ড্যাশবোর্ড থেকে যোগ করা যাবে।",
    "business_form.field.photos_save_hint":
      "প্রথমে আপনার লিস্টিং সংরক্ষণ করুন — এরপর সরাসরি আপনার ড্যাশবোর্ড থেকে অথবা এই লিস্টিং সম্পাদনা করে গ্যালারি ছবি যোগ করতে পারবেন।",
    "business_form.field.faq_save_hint":
      "প্রথমে আপনার লিস্টিং সংরক্ষণ করুন — এরপর সরাসরি আপনার ড্যাশবোর্ড থেকে অথবা এই লিস্টিং সম্পাদনা করে FAQ যোগ করতে পারবেন।",

    "business_form.action.save_changes": "পরিবর্তন সংরক্ষণ করুন",
    "business_form.action.create_listing": "লিস্টিং তৈরি করুন",

    // hours-exceptions-manager.tsx
    "hours_exceptions.section_title": "ছুটি ও বিশেষ সময়সূচী",
    "hours_exceptions.empty": "কোনো ছুটি বা বিশেষ সময় সেট করা নেই।",
    "hours_exceptions.add": "একটি তারিখ যোগ করুন",
    "hours_exceptions.closed": "বন্ধ",
    "hours_exceptions.special_hours": "বিশেষ সময়",
    "hours_exceptions.field.start_date": "থেকে",
    "hours_exceptions.field.end_date": "পর্যন্ত",
    "hours_exceptions.field.reason": "কারণ (ঐচ্ছিক)",
    "hours_exceptions.reason_placeholder": "যেমন: ঈদের ছুটি",
    "hours_exceptions.confirm_delete": "এই তারিখটি সরাতে চান? নিয়মিত সাপ্তাহিক সময়সূচী আবার প্রযোজ্য হবে।",
    "hours_exceptions.error.date_required": "প্রথমে একটি তারিখ নির্বাচন করুন।",
    "hours_exceptions.error.time_required": "খোলা ও বন্ধের সময় দিন, অথবা বন্ধ হিসেবে চিহ্নিত করুন।",

    // review-form.tsx
    "review_form.error.max_photos": "{max}টি পর্যন্ত ছবি যুক্ত করতে পারবেন।",
    "review_form.error.invalid_type": "{name}: শুধুমাত্র JPG, PNG অথবা WEBP ছবি অনুমোদিত।",
    "review_form.error.too_large": "{name}: অবশ্যই {max}MB-এর কম হতে হবে।",
    "review_form.error.rating_required": "অনুগ্রহ করে একটি স্টার রেটিং নির্বাচন করুন।",
    "review_form.error.content_too_short": "আপনার অভিজ্ঞতা সম্পর্কে অন্তত {min} অক্ষর লিখুন।",
    "review_form.that_photo": "ঐ ছবি",
    "review_form.photo": "ছবি",
    "review_form.toast.updated": "রিভিউ আপডেট হয়েছে",
    "review_form.toast.submitted": "রিভিউ জমা দেওয়া হয়েছে",
    "review_form.heading_edit": "আপনার রিভিউ সম্পাদনা করুন",
    "review_form.heading_write": "একটি রিভিউ লিখুন",
    "review_form.content_placeholder": "আপনার অভিজ্ঞতার বিস্তারিত জানান — কী ভালো ছিল, কী ভালো ছিল না।",
    "review_form.add_photos": "ছবি যোগ করুন",
    "review_form.camera": "ক্যামেরা",
    "review_form.gallery": "গ্যালারি",
    "review_form.remove_photo": "ছবি সরান",
    "review_form.save_changes": "পরিবর্তন সংরক্ষণ করুন",
    "review_form.submit_review": "রিভিউ জমা দিন",

    // booking-modal.tsx
    "booking.log_in_to_book": "বুক করতে লগ ইন করুন",
    "booking.sign_in_prompt": "{business}-এর সাথে অ্যাপয়েন্টমেন্টের অনুরোধ করতে সাইন ইন করুন।",
    "booking.appointment_confirmed": "অ্যাপয়েন্টমেন্ট নিশ্চিত হয়েছে",
    "booking.booking_requested": "বুকিং অনুরোধ করা হয়েছে",
    "booking.confirmed_with": "{business}-এর সাথে {number} নিশ্চিত হয়েছে।",
    "booking.will_confirm_soon": "{business} শীঘ্রই {number} নিশ্চিত করবে।",
    "booking.track_hint": "আপনি এটি আমার বুকিং থেকে ট্র্যাক করতে পারবেন।",
    "booking.view_booking": "বুকিং দেখুন",
    "booking.heading_book": "{service} বুক করুন",
    "booking.approx_duration": "আনুমানিক {minutes} মিনিট",
    "booking.no_staff": "এই সেবার জন্য বর্তমানে কোনো স্টাফ উপলব্ধ নেই।",
    "booking.field.staff": "স্টাফ",
    "booking.any_staff": "যেকোনো উপলব্ধ স্টাফ",
    "booking.field.date": "তারিখ",
    "booking.field.available_time": "উপলব্ধ সময়",
    "booking.no_slots": "এই তারিখে এই স্টাফের জন্য কোনো সময় উপলব্ধ নেই।",
    "booking.slot_booked": "বুক করা হয়েছে",
    "booking.field.name": "নাম",
    "booking.field.phone": "ফোন",
    "booking.field.note": "নোট",
    "booking.note_placeholder": "ব্যবসাটির জানা দরকার এমন কিছু থাকলে লিখুন…",
    "booking.book_at_time": "{time} বুক করুন",
    "booking.select_time": "একটি সময় নির্বাচন করুন",

    // message-owner-card.tsx
    "message_owner.heading": "মালিককে মেসেজ করুন",
    "message_owner.subheading": "উত্তর পাওয়ার সবচেয়ে দ্রুততম উপায়",
    "message_owner.own_business_note": "এটি আপনার লিস্টিং। গ্রাহকদের মেসেজ আপনার ওনার ইনবক্সে আসবে।",
    "message_owner.login_prompt": "{business}-কে ব্যক্তিগত মেসেজ পাঠাতে লগ ইন করুন।",
    "message_owner.login_to_message": "মেসেজ করতে লগ ইন করুন",
    "message_owner.sent_heading": "মেসেজ পাঠানো হয়েছে",
    "message_owner.sent_description": "মালিক এটি তাদের ইনবক্সে দেখতে পাবেন এবং সেখান থেকে উত্তর দিতে পারবেন।",
    "message_owner.send_another": "আরেকটি পাঠান",
    "message_owner.open_answer_suffix": "অন্য কিছুর জন্য আপনি নিচে মেসেজও পাঠাতে পারেন।",
    "message_owner.compose_placeholder": "দাম, উপলব্ধতা, অথবা বুকিং নিয়ে জিজ্ঞাসা করুন…",
    "message_owner.private_hint": "শুধু মালিক এটি দেখতে পাবেন",
    "message_owner.send_message": "মেসেজ পাঠান",
    "message_owner.prompt.prices": "আপনাদের দাম কেমন?",
    "message_owner.prompt.open_now": "আপনারা কি এখন খোলা আছেন?",
    "message_owner.prompt.bookings": "আপনারা কি বুকিং নেন?",
    "message_owner.prompt.location": "আপনারা ঠিক কোথায় অবস্থিত?",
    "message_owner.open_status.open_until": "হ্যাঁ, এখন খোলা আছে {time} পর্যন্ত।",
    "message_owner.open_status.open_no_time": "হ্যাঁ, এখন খোলা আছে।",
    "message_owner.open_status.closed_opens": "এখন বন্ধ আছে — {time} এ খুলবে।",
    "message_owner.open_status.closed_no_time": "এখন বন্ধ আছে।",
  },
};

export function translate(
  lang: PreferredLanguage,
  key: string,
  params?: Record<string, string | number>
): string {
  const own = dictionary[lang]?.[key];
  if (own === undefined && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] missing "${key}" for "${lang}" — falling back to English.`);
  }
  let text = own ?? dictionary.en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}

/**
 * Pluralized lookup — Bangla has no one/other split for cardinals (unlike
 * English), so `${count} ${count === 1 ? "review" : "reviews"}`-style ternaries
 * ported verbatim would be structurally wrong, not just mistranslated.
 * Intl.PluralRules resolves the correct category per-language (English gets
 * "one"/"other", Bangla always resolves to "other"), and looks up
 * "<key>.<category>" — e.g. tn(lang, "business_card.review_count", 1) reads
 * "business_card.review_count.one". Falls back to "<key>.other" when the
 * resolved category has no entry, so bn never needs a redundant ".one" key.
 */
export function translateCount(
  lang: PreferredLanguage,
  key: string,
  count: number,
  params?: Record<string, string | number>
): string {
  const category = new Intl.PluralRules(lang).select(count);
  const suffixed = `${key}.${category}`;
  const hasSuffixed = dictionary[lang]?.[suffixed] !== undefined || dictionary.en[suffixed] !== undefined;
  return translate(lang, hasSuffixed ? suffixed : `${key}.other`, { n: count, ...params });
}