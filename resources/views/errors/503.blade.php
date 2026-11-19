@extends('errors.layout')

@section('code', '503')
@section('title', 'Layanan sedang pemeliharaan')
@section('message', 'Janjiyan sedang menjalani pembaruan sistem singkat agar layanan tetap cepat dan stabil. Silakan coba kembali beberapa menit lagi.')
@section('actions')
    <button type="button" onclick="window.location.reload()" class="btn btn-primary">Periksa Kembali</button>
@endsection
