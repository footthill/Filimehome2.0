package com.footthill.filimehome

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.util.concurrent.Executors

class FilimeHomeExportPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(FilimeHomeExport(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
class FilimeHomeExport(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var pending: Promise? = null
  private var source: File? = null
  private val executor = Executors.newSingleThreadExecutor()
  override fun getName() = "FilimeHomeExport"
  init {
    context.addActivityEventListener(object : BaseActivityEventListener() {
      override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != 8042) return
        val promise = pending ?: return
        val file = source
        val destination = data?.data
        if (resultCode != Activity.RESULT_OK || destination == null || file == null) {
          pending = null; source = null; promise.resolve(null); return
        }
        executor.execute {
          try {
            context.contentResolver.openOutputStream(destination, "w")?.use { output ->
              file.inputStream().use { input -> input.copyTo(output, 1024 * 1024) }
            } ?: throw IllegalStateException("Cannot write to the selected location")
            promise.resolve(destination.toString())
          } catch (error: Exception) {
            try { android.provider.DocumentsContract.deleteDocument(context.contentResolver, destination) } catch (_: Exception) {}
            promise.reject("EXPORT_FAILED", "Could not save movie: ${error.message}", error)
          } finally { pending = null; source = null }
        }
      }
    })
  }
  @ReactMethod fun save(uri: String, title: String, promise: Promise) {
    if (pending != null) { promise.reject("EXPORT_BUSY", "A save is already in progress"); return }
    val activity = currentActivity
    if (activity == null) { promise.reject("NO_ACTIVITY", "Open FilimeHome to save this movie"); return }
    try {
      val file = File(Uri.parse(uri).path ?: "").canonicalFile
      require(file.path.startsWith(context.filesDir.canonicalPath + File.separator) && file.isFile) { "Download file is unavailable" }
      pending = promise; source = file
      val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE); type = "video/mp4"
        putExtra(Intent.EXTRA_TITLE, title.replace(Regex("[^\\p{L}\\p{N} ._-]"), "_").take(120) + ".mp4")
      }
      activity.startActivityForResult(intent, 8042)
    } catch (error: Exception) { pending = null; source = null; promise.reject("EXPORT_FAILED", error.message, error) }
  }
  @ReactMethod fun open(uri: String, promise: Promise) {
    try {
      require(uri.startsWith("content://")) { "Invalid saved movie" }
      val intent = Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(uri), "video/mp4")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent); promise.resolve(null)
    } catch (error: Exception) { promise.reject("OPEN_FAILED", "No video app could open this file. Use Samsung My Files.", error) }
  }
}
