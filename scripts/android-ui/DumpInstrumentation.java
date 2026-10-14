package com.filimehome.qa;

import android.app.Instrumentation;
import android.app.Activity;
import android.os.Bundle;
import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import android.util.Xml;
import org.xmlpull.v1.XmlSerializer;
import java.io.StringWriter;

/** Snapshot the current tree without waiting for a video/progress UI to become idle. */
public class DumpInstrumentation extends Instrumentation {
  @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
  private String value(CharSequence text) { return text == null ? "" : text.toString(); }
  private void node(XmlSerializer xml, AccessibilityNodeInfo n, int depth) throws Exception {
    if (n == null || depth > 80) return;
    Rect r = new Rect(); n.getBoundsInScreen(r);
    xml.startTag(null, "node");
    xml.attribute(null, "text", value(n.getText()));
    xml.attribute(null, "content-desc", value(n.getContentDescription()));
    xml.attribute(null, "resource-id", value(n.getViewIdResourceName()));
    xml.attribute(null, "enabled", String.valueOf(n.isEnabled()));
    xml.attribute(null, "selected", String.valueOf(n.isSelected()));
    xml.attribute(null, "bounds", "["+r.left+","+r.top+"]["+r.right+","+r.bottom+"]");
    for (int i=0; i<n.getChildCount(); i++) node(xml, n.getChild(i), depth+1);
    xml.endTag(null, "node");
  }
  @Override public void onStart() {
    Bundle result = new Bundle();
    try {
      android.accessibilityservice.AccessibilityServiceInfo info = getUiAutomation().getServiceInfo();
      info.flags |= android.accessibilityservice.AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
      getUiAutomation().setServiceInfo(info);
      AccessibilityNodeInfo root = getUiAutomation().getRootInActiveWindow();
      for (int attempt=0; root == null && attempt<30; attempt++) {
        Thread.sleep(100); root = getUiAutomation().getRootInActiveWindow();
      }
      if (root == null) throw new IllegalStateException("No active accessibility window");
      StringWriter writer = new StringWriter(); XmlSerializer xml = Xml.newSerializer();
      xml.setOutput(writer); xml.startDocument("UTF-8", true); xml.startTag(null,"hierarchy");
      node(xml, root, 0); xml.endTag(null,"hierarchy"); xml.endDocument();
      result.putString("tree", writer.toString()); finish(Activity.RESULT_OK, result);
    } catch (Exception e) { result.putString("error", e.toString()); finish(Activity.RESULT_CANCELED, result); }
  }
}
