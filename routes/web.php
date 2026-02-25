<?php

use App\Http\Controllers\Admin\UserManagementController;
use App\Http\Controllers\AnnotationEntryController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return to_route('annotations.index');
    })->name('dashboard');

    Route::get('annotations', [AnnotationEntryController::class, 'index'])->name('annotations.index');
    Route::get('annotations/entries', [AnnotationEntryController::class, 'entries'])->name('annotations.entries');
    Route::post('annotations', [AnnotationEntryController::class, 'store'])->name('annotations.store');
    Route::put('annotations/{annotation}', [AnnotationEntryController::class, 'update'])->name('annotations.update');
    Route::post('annotations/otc-drug-ages', [AnnotationEntryController::class, 'storeOtcDrugAge'])->name('annotations.otc-drug-ages.store');

    Route::middleware('can:manage-users')->group(function () {
        Route::get('annotations/export', [AnnotationEntryController::class, 'export'])->name('annotations.export');
        Route::get('annotations/otc-drug-ages/export', [AnnotationEntryController::class, 'exportOtcDrugAges'])->name('annotations.otc-drug-ages.export');
        Route::get('admin/users/create', [UserManagementController::class, 'create'])->name('admin.users.create');
        Route::post('admin/users', [UserManagementController::class, 'store'])->name('admin.users.store');
    });
});

require __DIR__.'/settings.php';
