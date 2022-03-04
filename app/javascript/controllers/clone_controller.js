import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [ "template" ]
  static values = { appendToElement: String }

  append() {
    const target = document.getElementById(this.appendToElementValue)

    for (const { content } of this.templateTargets) {
      target.append(content.cloneNode(true))
    }
  }
}
