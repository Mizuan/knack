<?php

use Illuminate\Support\Facades\Route;

Route::inertia('/', 'home')->name('home');
Route::inertia('privacy', 'privacy')->name('privacy');

Route::inertia('images-to-pdf', 'tools/images-to-pdf')->name('tools.images-to-pdf');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';
