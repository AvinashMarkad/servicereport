class ServiceReportApp {
  constructor() {
    this.engineerSignaturePad = null
    this.customerSignaturePad = null
    this.form = null
    this.isSubmitting = false

    this.init()
  }

  init() {
    document.addEventListener("DOMContentLoaded", () => {
      this.form = document.getElementById("serviceReportForm")
      this.initializeSignaturePads()
      this.bindEvents()
      this.setDefaultValues()
      this.loadSavedData()
    })
  }

  initializeSignaturePads() {
    try {
      const engineerCanvas = document.getElementById("engineerSignaturePad")
      const customerCanvas = document.getElementById("customerSignaturePad")

      if (!engineerCanvas || !customerCanvas) {
        throw new Error("Signature pad canvases not found")
      }

      // Configure signature pad options
      const signaturePadOptions = {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
        minWidth: 1,
        maxWidth: 2.5,
        throttle: 16,
        minDistance: 5,
      }

      const SignaturePad = window.SignaturePad // Declare SignaturePad variable
      this.engineerSignaturePad = new SignaturePad(engineerCanvas, signaturePadOptions)
      this.customerSignaturePad = new SignaturePad(customerCanvas, signaturePadOptions)

      // Handle canvas resize
      this.handleCanvasResize()
      window.addEventListener("resize", () => this.handleCanvasResize())

      // Prevent scrolling when drawing on mobile
      this.preventScrollOnSignature(engineerCanvas)
      this.preventScrollOnSignature(customerCanvas)
    } catch (error) {
      console.error("Error initializing signature pads:", error)
      this.showMessage("Error initializing signature pads", "error")
    }
  }

  handleCanvasResize() {
    const canvases = [
      { canvas: document.getElementById("engineerSignaturePad"), pad: this.engineerSignaturePad },
      { canvas: document.getElementById("customerSignaturePad"), pad: this.customerSignaturePad },
    ]

    canvases.forEach(({ canvas, pad }) => {
      if (canvas && pad) {
        const ratio = Math.max(window.devicePixelRatio || 1, 1)
        const rect = canvas.getBoundingClientRect()

        canvas.width = rect.width * ratio
        canvas.height = rect.height * ratio
        canvas.getContext("2d").scale(ratio, ratio)
        canvas.style.width = rect.width + "px"
        canvas.style.height = rect.height + "px"

        pad.clear()
      }
    })
  }

  preventScrollOnSignature(canvas) {
    const events = ["touchstart", "touchend", "touchmove"]
    events.forEach((event) => {
      canvas.addEventListener(
        event,
        (e) => {
          if (e.target === canvas) {
            e.preventDefault()
          }
        },
        { passive: false },
      )
    })
  }

  bindEvents() {
    // Form submission
    this.form.addEventListener("submit", (e) => this.handleFormSubmit(e))

    // Signature clearing
    document.getElementById("clearEngineerSignature")?.addEventListener("click", () => {
      this.clearSignature("engineer")
    })

    document.getElementById("clearCustomerSignature")?.addEventListener("click", () => {
      this.clearSignature("customer")
    })

    // Button actions
    document.getElementById("printReport")?.addEventListener("click", () => this.handlePrint())
    document.getElementById("downloadPdf")?.addEventListener("click", () => this.handlePdfDownload())
    document.getElementById("clearForm")?.addEventListener("click", () => this.handleClearForm())

    // Auto-save functionality
    this.form.addEventListener(
      "input",
      this.debounce(() => this.autoSave(), 2000),
    )

    // Form validation on blur
    const requiredFields = this.form.querySelectorAll("[required]")
    requiredFields.forEach((field) => {
      field.addEventListener("blur", () => this.validateField(field))
    })

    // Calculate total current automatically
    const currentFields = ["compressorCurrent", "fanPumpCurrent"]
    currentFields.forEach((fieldId) => {
      document.getElementById(fieldId)?.addEventListener("input", () => this.calculateTotalCurrent())
    })
  }

  setDefaultValues() {
    // Generate report number if empty
    const reportNoField = document.getElementById("reportNo")
    if (reportNoField && !reportNoField.value) {
      reportNoField.value = this.generateReportNumber()
    }

    // Set default date to today
    const dateDoneField = document.getElementById("dateDone")
    if (dateDoneField && !dateDoneField.value) {
      dateDoneField.value = new Date().toISOString().split("T")[0]
    }

    // Set default due date to 3 months from today
    const dateDueField = document.getElementById("dateDue")
    if (dateDueField && !dateDueField.value) {
      const dueDate = new Date()
      dueDate.setMonth(dueDate.getMonth() + 3)
      dateDueField.value = dueDate.toISOString().split("T")[0]
    }
  }

  generateReportNumber() {
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, "0")
    const day = now.getDate().toString().padStart(2, "0")
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")
    return `SR-${year}${month}${day}-${random}`
  }

  calculateTotalCurrent() {
    const compressorCurrent = Number.parseFloat(document.getElementById("compressorCurrent")?.value) || 0
    const fanPumpCurrent = Number.parseFloat(document.getElementById("fanPumpCurrent")?.value) || 0
    const totalCurrentField = document.getElementById("totalCurrent")

    if (totalCurrentField) {
      const total = compressorCurrent + fanPumpCurrent
      totalCurrentField.value = total > 0 ? total.toFixed(1) : ""
    }
  }

  validateField(field) {
    const errorElement = document.getElementById(`${field.id}-error`)
    let isValid = true
    let errorMessage = ""

    // Required field validation
    if (field.hasAttribute("required") && !field.value.trim()) {
      isValid = false
      errorMessage = "This field is required"
    }

    // Email validation
    if (field.type === "email" && field.value && !this.isValidEmail(field.value)) {
      isValid = false
      errorMessage = "Please enter a valid email address"
    }

    // Date validation
    if (field.type === "date" && field.value) {
      const selectedDate = new Date(field.value)
      const today = new Date()

      if (field.id === "dateDone" && selectedDate > today) {
        isValid = false
        errorMessage = "Date done cannot be in the future"
      }
    }

    // Update UI
    if (errorElement) {
      errorElement.textContent = errorMessage
      errorElement.classList.toggle("show", !isValid)
    }

    field.classList.toggle("error", !isValid)
    return isValid
  }

  validateForm() {
    const requiredFields = this.form.querySelectorAll("[required]")
    let isValid = true

    requiredFields.forEach((field) => {
      if (!this.validateField(field)) {
        isValid = false
      }
    })

    // Check if engineer signature is provided
    if (this.engineerSignaturePad && this.engineerSignaturePad.isEmpty()) {
      this.showMessage("Engineer signature is required", "error")
      isValid = false
    }

    return isValid
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  clearSignature(type) {
    if (type === "engineer" && this.engineerSignaturePad) {
      this.engineerSignaturePad.clear()
      document.getElementById("engineerSignature").value = ""
    } else if (type === "customer" && this.customerSignaturePad) {
      this.customerSignaturePad.clear()
      document.getElementById("customerSignature").value = ""
    }
  }

  async handleFormSubmit(e) {
    e.preventDefault()

    if (this.isSubmitting) return

    this.isSubmitting = true
    this.showLoading(true)

    try {
      if (!this.validateForm()) {
        throw new Error("Please fix the validation errors before submitting")
      }

      // Save signatures
      this.saveSignatures()

      // Get form data
      const formData = this.getFormData()

      // Save to localStorage
      localStorage.setItem("serviceReport", JSON.stringify(formData))
      localStorage.setItem("serviceReportTimestamp", Date.now().toString())

      this.showMessage("Report saved successfully!", "success")
    } catch (error) {
      console.error("Error saving report:", error)
      this.showMessage(error.message || "Error saving report", "error")
    } finally {
      this.isSubmitting = false
      this.showLoading(false)
    }
  }

  saveSignatures() {
    // Save engineer signature
    if (this.engineerSignaturePad && !this.engineerSignaturePad.isEmpty()) {
      document.getElementById("engineerSignature").value = this.engineerSignaturePad.toDataURL()
    }

    // Save customer signature
    if (this.customerSignaturePad && !this.customerSignaturePad.isEmpty()) {
      document.getElementById("customerSignature").value = this.customerSignaturePad.toDataURL()
    }
  }

  getFormData() {
    const formData = new FormData(this.form)
    const data = {}

    // Convert FormData to object
    for (const [key, value] of formData.entries()) {
      if (data[key]) {
        // Handle multiple values (like checkboxes)
        if (Array.isArray(data[key])) {
          data[key].push(value)
        } else {
          data[key] = [data[key], value]
        }
      } else {
        data[key] = value
      }
    }

    // Add metadata
    data.timestamp = new Date().toISOString()
    data.version = "1.0"

    return data
  }

  async handlePrint() {
    try {
      this.saveSignatures()

      // Replace signature pads with images for printing
      const signatureImages = this.replaceSignaturesForPrint()

      // Print
      window.print()

      // Restore signature pads after printing
      setTimeout(() => {
        this.restoreSignaturesAfterPrint(signatureImages)
      }, 1000)
    } catch (error) {
      console.error("Error printing report:", error)
      this.showMessage("Error printing report", "error")
    }
  }

  replaceSignaturesForPrint() {
    const signatureImages = []

    // Engineer signature
    const engineerCanvas = document.getElementById("engineerSignaturePad")
    const engineerSigData = document.getElementById("engineerSignature").value

    if (engineerCanvas && engineerSigData) {
      const img = document.createElement("img")
      img.src = engineerSigData
      img.style.maxWidth = "100%"
      img.style.maxHeight = "150px"
      img.style.border = "1px solid #000"

      signatureImages.push({
        original: engineerCanvas,
        replacement: img,
        parent: engineerCanvas.parentNode,
      })

      engineerCanvas.parentNode.replaceChild(img, engineerCanvas)
    }

    // Customer signature
    const customerCanvas = document.getElementById("customerSignaturePad")
    const customerSigData = document.getElementById("customerSignature").value

    if (customerCanvas && customerSigData) {
      const img = document.createElement("img")
      img.src = customerSigData
      img.style.maxWidth = "100%"
      img.style.maxHeight = "150px"
      img.style.border = "1px solid #000"

      signatureImages.push({
        original: customerCanvas,
        replacement: img,
        parent: customerCanvas.parentNode,
      })

      customerCanvas.parentNode.replaceChild(img, customerCanvas)
    }

    return signatureImages
  }

  restoreSignaturesAfterPrint(signatureImages) {
    signatureImages.forEach(({ original, replacement, parent }) => {
      parent.replaceChild(original, replacement)
    })

    // Restore signature pad data
    const engineerSigData = document.getElementById("engineerSignature").value
    const customerSigData = document.getElementById("customerSignature").value

    if (engineerSigData && this.engineerSignaturePad) {
      this.engineerSignaturePad.fromDataURL(engineerSigData)
    }

    if (customerSigData && this.customerSignaturePad) {
      this.customerSignaturePad.fromDataURL(customerSigData)
    }
  }

  async handlePdfDownload() {
    const html2pdf = window.html2pdf
    if (!html2pdf) {
      this.showMessage("PDF library not loaded. Please refresh the page and try again.", "error")
      return
    }

    try {
      this.showLoading(true)
      this.saveSignatures()

      // Replace signature pads with images for PDF rendering
      const signatureImages = this.replaceSignaturesForPrint()

      const element = document.querySelector(".form-container")
      const reportNo = document.getElementById("reportNo").value || "service_report"

      const options = {
        margin: [10, 10, 10, 10],
        filename: `${reportNo}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: window.devicePixelRatio > 1 ? 3 : 2,
          useCORS: true,
          allowTaint: true,
          scrollY: 0,
          scrollX: 0,
          windowWidth: document.documentElement.scrollWidth,
          windowHeight: document.documentElement.scrollHeight,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
      }

      await html2pdf().set(options).from(element).save()

      this.showMessage("PDF downloaded successfully!", "success")

      // Restore signature canvases after PDF generation
      setTimeout(() => {
        this.restoreSignaturesAfterPrint(signatureImages)
      }, 1000)
    } catch (error) {
      console.error("Error generating PDF:", error)
      this.showMessage("Error generating PDF. Please try again.", "error")
    } finally {
      this.showLoading(false)
    }
  }


  handleClearForm() {
    if (confirm("Are you sure you want to clear all form data? This action cannot be undone.")) {
      // Clear form
      this.form.reset()

      // Clear signatures
      this.clearSignature("engineer")
      this.clearSignature("customer")

      // Clear localStorage
      localStorage.removeItem("serviceReport")
      localStorage.removeItem("serviceReportTimestamp")

      // Reset default values
      this.setDefaultValues()

      // Clear validation errors
      const errorMessages = document.querySelectorAll(".error-message")
      errorMessages.forEach((error) => {
        error.classList.remove("show")
        error.textContent = ""
      })

      const errorFields = document.querySelectorAll(".error")
      errorFields.forEach((field) => field.classList.remove("error"))

      this.showMessage("Form cleared successfully", "success")
    }
  }

  autoSave() {
    try {
      this.saveSignatures()
      const formData = this.getFormData()
      localStorage.setItem("serviceReportDraft", JSON.stringify(formData))
      localStorage.setItem("serviceReportDraftTimestamp", Date.now().toString())
    } catch (error) {
      console.error("Auto-save failed:", error)
    }
  }

  loadSavedData() {
    try {
      const savedData = localStorage.getItem("serviceReportDraft")
      if (savedData) {
        const data = JSON.parse(savedData)
        const timestamp = localStorage.getItem("serviceReportDraftTimestamp")

        // Only load if saved within last 24 hours
        if (timestamp && Date.now() - Number.parseInt(timestamp) < 24 * 60 * 60 * 1000) {
          if (confirm("Found a saved draft. Would you like to restore it?")) {
            this.populateForm(data)
            this.showMessage("Draft restored successfully", "success")
          }
        }
      }
    } catch (error) {
      console.error("Error loading saved data:", error)
    }
  }

  populateForm(data) {
    Object.keys(data).forEach((key) => {
      const element = document.getElementById(key) || document.querySelector(`[name="${key}"]`)
      if (element) {
        if (element.type === "checkbox") {
          element.checked = Array.isArray(data[key]) ? data[key].includes(element.value) : data[key] === element.value
        } else if (element.type === "radio") {
          element.checked = data[key] === element.value
        } else {
          element.value = data[key]
        }
      }
    })

    // Restore signatures
    if (data.engineerSignature && this.engineerSignaturePad) {
      this.engineerSignaturePad.fromDataURL(data.engineerSignature)
    }
    if (data.customerSignature && this.customerSignaturePad) {
      this.customerSignaturePad.fromDataURL(data.customerSignature)
    }
  }

  showMessage(message, type = "info") {
    const messageContainer = document.getElementById("messageContainer")
    if (!messageContainer) return

    const messageElement = document.createElement("div")
    messageElement.className = `message ${type}`
    messageElement.innerHTML = `
            <i class="fas fa-${this.getMessageIcon(type)}"></i>
            ${message}
        `

    messageContainer.appendChild(messageElement)

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement)
      }
    }, 5000)
  }

  getMessageIcon(type) {
    const icons = {
      success: "check-circle",
      error: "exclamation-circle",
      warning: "exclamation-triangle",
      info: "info-circle",
    }
    return icons[type] || "info-circle"
  }

  showLoading(show) {
    const loadingOverlay = document.getElementById("loadingOverlay")
    if (loadingOverlay) {
      loadingOverlay.classList.toggle("show", show)
    }
  }

  debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }
}

// Initialize the application
const serviceReportApp = new ServiceReportApp()

// Export for potential external use
if (typeof module !== "undefined" && module.exports) {
  module.exports = ServiceReportApp
}
