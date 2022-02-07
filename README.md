# Hotwire: Server-render alerts for client-side actions

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.png)][heroku-deploy-app]

[heroku-deploy-app]: https://heroku.com/deploy?template=https://github.com/thoughtbot/hotwire-example-template/tree/hotwire-example-button-alert-template

[It all starts with HTML][].

When HTML serves as their [serialization format][], controllers and views
translate our application's state-of-the-world into a document, transmit that
document over HTTP to browsers that reconstruct it to enable end-users.

With the advent of [Stimulus Action Descriptors][] and [`<turbo-stream>`][Turbo
Stream] elements and their embedded [`<template>`][template] element content,
servers can even encode contingency plans directly into the document's elements.

**Rendering**: client-side, synchronous, immediate, Kinetic energy
**Callbacks**: client-side, asynchronous, deferred, Potential energy
**`<template>`-encoded rendering**: both server- and client-side, asynchronous, deferred, Potential energy

**Value proposition**: You have abstractions and extractions on the server-side,
re-use them to share concepts with the client-side without re-inventing parallel
versions of them.

Servers can encode design decisions into the HTML in a way that's durable across
transmission and reconstruction.

[serialization format]: https://en.wikipedia.org/wiki/Serialization
[Stimulus Action Descriptors]: https://stimulus.hotwired.dev/reference/actions#descriptors
[Turbo Stream]: https://turbo.hotwired.dev/handbook/streams

[Stimulus][] controllers [synchronize their state with the document's
HTML][stimulus-state] through [attribute][]-backed [Values][] and
[element][]-backed [Targets][].

Since this interaction is _only_ client-side in the browser, there's an
opportunity to do as much work as possible on the server, to the point where the
client's responsibilities are constrained, and only include appending to and
removing from the document

* co-locates decisions about structure, content, styles, and element references
  in the same server-generated template
* declarative, pre-populated state

[It All Starts With HTML]: https://stimulus.hotwired.dev/handbook/hello-stimulus#it-all-starts-with-html
[Stimulus]: https://stimulus.hotwired.dev/
[stimulus-state]: https://stimulus.hotwired.dev/handbook/managing-state
[attribute]: https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
[element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element
[Values]: https://stimulus.hotwired.dev/handbook/managing-state#using-values
[Targets]: https://stimulus.hotwired.dev/reference/targets
[template]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template
[_Building Something Real_]: https://stimulus.hotwired.dev/handbook/building-something-real
[Stimulus Handbook]: https://stimulus.hotwired.dev/handbook/introduction

We'll re-create an example from the [_Building Something Real_][] section of the
[Stimulus Handbook][]. To start, we'll enhance a button to copy an invitation
code to the end-user's clipboard. Next, we'll display a server-rendered alert
message to notify the end-user that they've copied the code. Finally, through
the passage of time, we'll dismiss the alert. Our implementation won't depend on
[XMLHttpRequest][], [fetch][], or any client-side templating.

[XMLHttpRequest]: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API

The code samples shared in this article omit the majority of the application's
setup. The initial code was generated by executing `rails new`. The rest of the
[source code][] from this article (including a [suite of tests][]) can be found
on GitHub, and is best read either [commit-by-commit][], or as a [unified
diff][].

[source code]: https://github.com/thoughtbot/hotwire-example-template/tree/hotwire-example-button-alert-template
[suite of tests]: https://github.com/thoughtbot/hotwire-example-template/tree/hotwire-example-button-alert-template
[commit-by-commit]: https://github.com/thoughtbot/hotwire-example-template/commits/hotwire-example-button-alert-template
[unified diff]: https://github.com/thoughtbot/hotwire-example-template/compare/hotwire-example-button-alert-template

## Our starting point

`InvitationCodesController#show` serves as our only route. The `#show` action
assigns the value of `params[:id]` into the `@invitation_code` instance
variable. For example, a [`GET
http://localhost:3000/invitation_codes/abc123`][GET-abc123] request would assign
`@invitation_code = "abc123"`:

[GET-abc123]: http://localhost:3000/invitation_codes/abc123

```ruby
# app/controllers/invitation_codes_controller.rb

class InvitationCodesController < ApplicationController
  def show
    @invitation_code = params[:id]
  end
end
```

A more production-ready version might read an invitation code from the database,
or generate one on-the-fly.

The `app/views/invitation_codes/show.html.erb` template renders two `<fieldset>`
elements: the first presents an [`<input readonly>`][input-readonly] to copy the
invitation code out of, and the second presents an `<input>` to paste the code
into:

[input-readonly]: https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/readonly

```erb
<%# app/views/invitation_codes/show.html.erb %>

<fieldset>
  <legend>Copy</legend>

  <label>
    Invitation code

    <input value="<%= @invitation_code %>" readonly>
  </label>

  <button type="button" value="<%= @invitation_code %>"
          data-controller="clipboard"
          data-action="click->clipboard#copy">
    Copy to clipboard
  </button>
</fieldset>

<fieldset>
  <legend>Paste</legend>

  <label>
    Invitation code
    <input>
  </label>
</fieldset>
```

The first `<fieldset>` pairs the pre-populated `<input>` element with a
[`<button type="button">`][type="button"] element. The `<button>` [routes
`click` events][stimulus-actions] to a `clipboard` [controller][]. Like
_Building Something Real_'s [`clipboard` controller][example-controller], ours
calls [`navigator.clipboard.writeText`][writeText]:

[type="button"]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button#attr-type
[readonly]: https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/readonly
[Clipboard's]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard
[stimulus-actions]: https://stimulus.hotwired.dev/reference/actions
[controller]: https://stimulus.hotwired.dev/reference/controllers
[example-controller]: https://stimulus.hotwired.dev/handbook/building-something-real#connecting-the-action
[writeText]: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText

```javascript
// app/javascript/controllers/clipboard_controller.js

import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  copy({ target: { value } }) {
    navigator.clipboard.writeText(value)
  }
}
```

https://user-images.githubusercontent.com/2575027/154692773-cc91ff39-63e3-4e4e-857d-0657ea39d56e.mov

## Pushing alerts

If we'll be notifying end-user that they've copied the code to their clipboard,
we'll need somewhere to push those messages. We'll render a `<div>` marked with
[`[id="alerts"]`][id-attr]:

```diff
--- a/app/views/invitation_codes/show.html.erb
+++ b/app/views/invitation_codes/show.html.erb
+<div id="alerts" class="absolute bottom-0 right-0 w-96"></div>
+
 <fieldset>
```

Next, we'll introduce the `app/views/application/_alert.html.erb` view partial
to render an individual alert message that's lightly styled to resemble a [toast
message][toast]:

[toast]: https://getbootstrap.com/docs/4.3/components/toasts/

```erb
<%# app/views/application/_alert.html.erb %>

<div role="alert" class="border border-solid rounded-md m-4 p-4">
  <%= yield %>
</div>
```

Then, within the `<button type="button">` element, we'll nest a `<template>`
element containing a render of `app/views/application/_alert.html.erb` with
`"Copied to clipboard"` as its contents:

```diff
--- a/app/views/invitation_codes/show.html.erb
+++ b/app/views/invitation_codes/show.html.erb
  <button type="button" value="<%= @invitation_code %>"
          data-controller="clipboard"
          data-action="click->clipboard#copy">
    Copy to clipboard
+
+   <template>
+     <%= render "alert" do %>
+       Copied to clipboard
+     <% end %>
+   </template>
  </button>
```

On its own, a `<template>` element is completely inert, and its contents are not
rendered.

We'll treat the outer `<template>` element as a `clone` target by marking it
with the `[data-clone-target="template"]` attribute. We'll route `click` events
dispatched by the `<button>` to a `clone#append` action that [appends][] the
`<template>` contents to the document. We'll mark the `<button>` with
`[data-clone-append-to-element-value="alerts"]` to encode _which_ element to
append its contents to. The `"alerts"` value directs the `clone#append` action
to append the `<template data-clone-target="template">` element's contents into
the page's `<div id="alerts">`:

[appends]: https://developer.mozilla.org/en-US/docs/Web/API/Element/append

```diff
--- a/app/views/invitation_codes/show.html.erb
+++ b/app/views/invitation_codes/show.html.erb
  <button type="button" value="<%= @invitation_code %>"
-          data-controller="clipboard"
+          data-controller="clipboard clone"
+          data-clone-append-to-element-value="alerts"
-          data-action="click->clipboard#copy">
+          data-action="click->clipboard#copy click->clone#append">
    Copy to clipboard

-   <template>
+   <template data-clone-target="template">
      <%= render "alert" do %>
        Copied to clipboard
      <% end %>
    </template>
  </button>
```

With our server-generated content in-place, we'll introduce the `clone`
controller. It acts upon the `<template>` elements that it references through
its [`templateTargets` property][stimulus-target]. The `clone#append` action
iterates through that collection, [clones][cloneNode] each element's
[content][template-content] fragment, and appends that content fragment to the
document:

[template-content]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement/content
[cloneNode]: https://developer.mozilla.org/en-US/docs/Web/API/Node/cloneNode
[stimulus-target]: https://stimulus.hotwired.dev/reference/targets

```javascript
// app/javascript/controllers/clone_controller.js

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
```

The `clone#append` references the collection of `<template>` elements through
its the **plural** `this.templateTargets` property. In our example's case,
there's a single element marked with `[data-clone-target="template"]`, so direct
access through the **singular** `this.templateTarget` could suffice. Access to
singular references should guard against missing
`[data-clone-target="template"]` targets through the [**existential**
`this.hasTemplateTarget` property][target properties]. Looping over the
collection of targets supports **both** scenarios **without** any conditionals,
and bakes-in future-proofed support for acting upon multiple embedded
`<template>` targets.

[target properties]: https://stimulus.hotwired.dev/reference/targets#properties

https://user-images.githubusercontent.com/2575027/154692364-0e5783e6-6197-4cff-95b4-256d80482896.mov

### Pushing alerts with a Turbo Stream

Since `<turbo-stream>` elements embed `<template>` elements of their own,
they're inert until they're [connected to the document][]. Similarly, browsers
omit the contents of `<template>` elements during rendering. By embedded a
`<turbo-stream>` element _into_ a `<template>` element, we're able to transform
the `<turbo-stream>` element's typically [kinetic energy][] into a [potential
energy][] of sorts.

```diff
--- a/app/views/invitation_codes/show.html.erb
+++ b/app/views/invitation_codes/show.html.erb
   <button type="button" value="<%= @invitation_code %>"
           data-controller="clipboard clone"
           data-clone-append-to-element-value="alerts"
           data-action="click->clipboard#copy click->clone#append">
     Copy to clipboard

     <template data-clone-target="template">
+      <turbo-stream>
+        <template>
           <%= render "alert" do %>
             Copied to clipboard
           <% end %>
+        </template>
+      </turbo-stream>
     </template>
   </button>
 </fieldset>
```

Since the `<turbo-stream>` element's `[target]` attribute encodes which elements
in the document to operate upon, we can append the `<turbo-stream>` element to
_any_ element in the document. It will execute the operation, then remove
itself. The `clone#append` action appends the element to the [Event.target][]
(in our case, the `<button>` element).


```diff
--- a/app/views/invitation_codes/show.html.erb
+++ b/app/views/invitation_codes/show.html.erb
   <button type="button" value="<%= @invitation_code %>"
           data-controller="clipboard clone"
-          data-clone-append-to-element-value="alerts"
           data-action="click->clipboard#copy click->clone#append">
     Copy to clipboard

     <template data-clone-target="template">
-      <turbo-stream>
+      <turbo-stream action="append" target="alerts">
         <template>
           <%= render "alert" do %>
             Copied to clipboard
           <% end %>
         </template>
       </turbo-stream>
     </template>
     </template>
   </button>
 </fieldset>
```

```diff
--- a/app/javascript/controllers/clone_controller.js
+++ b/app/javascript/controllers/clone_controller.js
 export default class extends Controller {
   static targets = [ "template" ]
-  static values = { appendToElement: String }
-
-  append() {
-    const target = document.getElementById(this.appendToElementValue)
-
+  append({ target }) {
     for (const { content } of this.templateTargets) {
       target.append(content.cloneNode(true))
     }
```

[connected to the document]: https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected
[kinetic energy]: https://en.wikipedia.org/wiki/Kinetic_energy
[potential energy]: https://en.wikipedia.org/wiki/Potential_energy
[Event.target]: https://developer.mozilla.org/en-US/docs/Web/API/Event/target

We'll treat the outer `<template>` element as a `clone` target by marking it
with the `[data-clone-target="template"]` attribute, and we'll route `click`
events to a `clone` controller to [append][] the `<template>` element's contents
to the document whenever the `<button>` element is clicked:
